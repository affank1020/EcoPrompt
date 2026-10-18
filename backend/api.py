import os
from typing import Annotated, Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field, AfterValidator
from fastapi.middleware.cors import CORSMiddleware
import tiktoken

from joint_classifier import classify
from compressor import Compressor

# Warm up at startup so model loading and CUDA init don't slow the first request.
classify("warm up")

compressor = Compressor()
compressor.warm_up()

app = FastAPI()
# Production defaults to no cross-origin browser access; list exact extension IDs.
origins = [s.strip() for s in os.getenv("ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000" if os.getenv("APP_ENV", "development") == "development" else ""
).split(",") if s.strip()]
if any("*" in origin for origin in origins):
    raise ValueError("ALLOWED_ORIGINS must contain exact origins, not wildcards")
app.add_middleware(CORSMiddleware, allow_origins=origins,
    allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization"])


def nonblank(value: str) -> str:
    if not value.strip():
        raise ValueError("Prompt must not be blank")
    return value

PromptText = Annotated[str, Field(strict=True, min_length=1, max_length=50000), AfterValidator(nonblank)]
Epsilon = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]


class PromptRequest(BaseModel):
    prompt: PromptText
    epsilon: Epsilon = 0.5

class BulkPromptRequest(BaseModel):
    prompts: list[PromptText] = Field(min_length=1, max_length=200)
    epsilon: Epsilon = 0.5

class CompressRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=20000)
    preset: Literal["light", "balanced", "aggressive"] = "balanced"

class ConsumptionRequest(BaseModel):
    prompt: str

def convert_to_tokens(prompt: str):
    # Placeholder function to convert prompt to tokens
    encoding = tiktoken.get_encoding("o200k_base")
    return encoding.encode(prompt)

def calculate_consumption(input_tokens, label):
    num_of_input_tokens = len(input_tokens)
    num_of_output_tokens = num_of_input_tokens

    if label == "medium":
        num_of_output_tokens *= 1.5
    elif label == "hard":
        num_of_output_tokens *= 2

    total_tokens = num_of_input_tokens + num_of_output_tokens

    energy_cost = total_tokens * 0.000453  # Wh
    water_cost = total_tokens * 0.000429   # mL

    return water_cost, energy_cost


@app.get("/")
async def read_root():
    return {"message": "Hello, World!"}

def analyse_one(prompt: str, epsilon: float):
    label, probabilities = classify(prompt, epsilon)
    tokens = convert_to_tokens(prompt)
    water_cost, energy_cost = calculate_consumption(tokens, label)
    return {"prompt": prompt, "label": label, "probabilities": probabilities,
            "water_cost": water_cost, "energy_cost": energy_cost, "tokens": len(tokens)}


@app.post("/analyse")
def analyse_prompt(req: PromptRequest):
    return analyse_one(req.prompt, req.epsilon)


@app.post("/analyse/bulk")
def analyse_bulk(req: BulkPromptRequest):
    # Validate the entire request first. Failures abort the request (no partial result).
    results = [analyse_one(prompt, req.epsilon) for prompt in req.prompts]
    return {"results": results, "count": len(results)}


@app.post("/compress")
def compress_prompt(req: CompressRequest):
    result = compressor.compress(req.prompt, req.preset)
    # Never log prompt text: counts and timing only.
    print(f"Compression ({result['preset']}, {result['reason']}) took {result['latency_ms']} ms, "
        f"tokens {result['tokens_before']} -> {result['tokens_after']}.")
    return result
