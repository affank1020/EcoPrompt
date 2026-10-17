import json
import os
from pathlib import Path

os.environ.setdefault("HF_HOME", str(Path(__file__).resolve().parent / ".runtime" / "huggingface"))

import torch
from huggingface_hub import hf_hub_download
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

# The adapter is a CAUSAL_LM LoRA (no classification head): it was trained to
# answer with one word, so load it as a causal LM, not for sequence classification.
base_model_id = "Qwen/Qwen3.5-0.8B"
adapter_id = "regolo/brick-complexity-extractor"

# System prompt and user template used during training
meta = json.load(open(hf_hub_download(adapter_id, "training_metadata.json")))

tokenizer = AutoTokenizer.from_pretrained(base_model_id)
model = AutoModelForCausalLM.from_pretrained(base_model_id)
model = PeftModel.from_pretrained(model, adapter_id)
model.eval()

labels = ["easy", "medium", "hard"]
label_ids = [tokenizer.encode(l, add_special_tokens=False)[0] for l in labels]


def classify(query):
    messages = [
        {"role": "system", "content": meta["system_prompt"]},
        {"role": "user", "content": meta["user_template"].format(query=query)},
    ]
    prompt = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True, enable_thinking=False
    )
    inputs = tokenizer(prompt, return_tensors="pt")
    with torch.no_grad():
        next_token_logits = model(**inputs).logits[0, -1]
    # Compare the scores of the three label tokens only
    probs = next_token_logits[label_ids].softmax(-1)
    return labels[probs.argmax().item()], dict(zip(labels, probs.tolist()))
