import os
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import tiktoken
from tiktoken import Encoding

from joint_classifier import classify
from compressor import Compressor

# Warm up at startup so model loading and CUDA init don't slow the first request.
classify("warm up")

compressor = Compressor()
compressor.warm_up()

app = FastAPI()
ALLOWED_ORIGINS = [
      origin.strip()
      for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
      if origin.strip()
]   

app.add_middleware(
      CORSMiddleware,
      allow_origins=ALLOWED_ORIGINS,
      allow_origin_regex=r"chrome-extension://.*",
      allow_methods=["GET", "POST"],
      allow_headers=["Content-Type", "Authorization"],
)

class PromptRequest(BaseModel):
    prompt: str
    epsilon: float = 0.5

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

@app.post("/analyse")
def analyse_prompt(req: PromptRequest):
    import time


    start_time = time.time()
    label, probabilities = classify(req.prompt, req.epsilon)
    print(f"Classification took {time.time() - start_time:.2f} seconds.")

    start_time = time.time()
    tokens = convert_to_tokens(req.prompt)
    print(f"Token conversion took {time.time() - start_time:.2f} seconds.")

    start_time = time.time()
    water_cost, energy_cost = calculate_consumption(tokens, label)
    print(f"Consumption calculation took {time.time() - start_time:.2f} seconds.")


    return {"prompt": req.prompt, "label": label, "probabilities": probabilities, "water_cost": water_cost, "energy_cost": energy_cost}

@app.post("/compress")
def compress_prompt(req: CompressRequest):
    result = compressor.compress(req.prompt, req.preset)
    # Never log prompt text: counts and timing only.
    print(f"Compression ({result['preset']}, {result['reason']}) took {result['latency_ms']} ms, "
        f"tokens {result['tokens_before']} -> {result['tokens_after']}.")
    return result

@app.post("/analyse/bulk")
def analyse_bulk(req: BulkPromptRequest):
    """Analyse up to 200 prompts in order using the same classifier as /analyse."""
    results = [analyse_one(prompt, req.epsilon) for prompt in req.prompts]
    return {"results": results, "count": len(results)}