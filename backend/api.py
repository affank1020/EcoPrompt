from fastapi import FastAPI
from pydantic import BaseModel
import tiktoken
from tiktoken import Encoding

from joint_classifier import classify

# Warm up at startup so model loading and CUDA init don't slow the first request.
classify("warm up")

app = FastAPI()


class PromptRequest(BaseModel):
    prompt: str
    epsilon: float = 0.5


class ConsumptionRequest(BaseModel):
    prompt: str

def convert_to_tokens(prompt: str):
    # Placeholder function to convert prompt to tokens
    encoding = tiktoken.get_encoding("o200k_base")
    return encoding.encode(prompt)

def calculate_consumption(input_tokens, label):
    # Placeholder function to calculate water and energy consumption based on tokens and label
    num_of_output_tokens = len(input_tokens)
    if label == "medium":
        num_of_output_tokens = num_of_output_tokens * 1.5
    elif label == "hard":
        num_of_output_tokens = num_of_output_tokens * 2

    energy_cost = len(input_tokens) * 0.2 + num_of_output_tokens * 1
    water_cost = energy_cost * 2  # This needs more research to get a more accurate estimate, currently 1Wh = 1.1 - 6.7 ml/Wh.

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
