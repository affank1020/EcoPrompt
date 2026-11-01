# Same Python minor version as the local .venv the API was tested with
FROM python:3.14-slim
# Hugging Face Spaces runs containers as UID 1000; build as that user so caches are readable/writable
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH
WORKDIR $HOME/app
ENV PYTHONUNBUFFERED=1 HF_HOME=$HOME/app/.hf TIKTOKEN_CACHE_DIR=$HOME/app/.tiktoken

# CPU torch keeps the image several GB smaller than the default CUDA build
RUN pip install --no-cache-dir torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu
COPY --chown=user requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

# Bake model weights and the tokenizer encoding into the image so cold starts don't download them
RUN python -c "from huggingface_hub import snapshot_download as get; \
[get(repo) for repo in ('Qwen/Qwen3.5-0.8B', 'regolo/brick-complexity-extractor', \
'microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank')]; \
import tiktoken; tiktoken.get_encoding('o200k_base')"
# Everything is cached above; fail loudly instead of downloading at runtime
ENV HF_HUB_OFFLINE=1

COPY --chown=user *.py ./
COPY --chown=user artifacts/complexity_model.joblib artifacts/
EXPOSE 8000
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
