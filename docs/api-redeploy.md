# API redeploy runbook

How to ship a change to the EcoPrompt API, and how to rebuild the server from scratch if it is ever lost.

| | |
|---|---|
| Host | Oracle Cloud Always Free, Ampere A1 VM `ecoprompt-api` (UK South / London), Ubuntu 24.04 |
| Public IP | `140.238.80.190` |
| API URL | `https://140-238-80-190.sslip.io` (Caddy → `127.0.0.1:8000` → Docker container `ecoprompt-api`) |
| SSH | `ssh -i %USERPROFILE%\.ssh\oracle-ecoprompt.key ubuntu@140.238.80.190` |
| Files on the VM | `~/ecoprompt-api/` (Dockerfile, requirements, `.py` files, `artifacts/`, `.env`) |
| Secrets | `API_KEY` lives only in `~/ecoprompt-api/.env` on the VM, in Vercel (`BACKEND_API_KEY`) and in the password manager. Never commit it. |

Commands marked **(PC)** run in a cmd window on Windows; **(VM)** run in an SSH session on the server.

---

## Part 1 – Redeploy after a change

### 1. Make and test the change locally

**(PC)** from `backend\` with the venv active:
```bat
cd C:\Users\ghile\GitRepos\EcoPrompt\backend
.venv\Scripts\activate
python -m unittest test_api test_joint_classifier -v
```
All tests must pass. If you changed code paths the unit tests mock out (model loading, compression), also run the API locally (`uvicorn api:app --port 8000`) and try it, or build and run the Docker image locally.

Then commit and push the change to GitHub so the deployed code always matches a commit.

### 2. Retrain the classifier (only if needed)

Only needed if `complexity.py`, the training notebook or its data changed. Qwen and LLMLingua are never trained by us; the Docker build downloads them.

1. Run `main.ipynb` (or `python run_notebook.py`).
2. Check `artifacts/metrics.json`: scores are sensible, and the `versions` block (`scikit-learn`, `numpy`, `joblib`) matches the pins in `requirements-prod.txt`. If they differ, update `requirements-prod.txt`, because a joblib file must be loaded with the scikit-learn version that saved it.

### 3. Dependency changes (only if needed)

If you added or upgraded a Python package, pin the exact version in `backend/requirements-prod.txt` (use `pip freeze` from the working venv). `torch` is pinned in the `Dockerfile` instead, because it comes from the CPU-only index.

### 4. Package and copy the files to the VM

**(PC)** from `backend\`:
```bat
tar -czf api.tgz Dockerfile requirements-prod.txt api.py joint_classifier.py compressor.py train_complexity_model.py artifacts/complexity_model.joblib
scp -i %USERPROFILE%\.ssh\oracle-ecoprompt.key api.tgz ubuntu@140.238.80.190:~
del api.tgz
```
If you added a new `.py` module that the API imports, add it to the `tar` list.

**(VM)** unpack over the old files (`.env` is not in the bundle, so it is kept):
```bash
tar -xzf ~/api.tgz -C ~/ecoprompt-api && rm ~/api.tgz
ls -R ~/ecoprompt-api
```

### 5. Build the new image (the old one keeps serving)

**(VM)** keep a copy of the current image for rollback, then build in tmux so a dropped connection doesn't kill the build:
```bash
docker tag ecoprompt-api ecoprompt-api:previous
tmux new -s build
cd ~/ecoprompt-api && docker build -t ecoprompt-api .
```
Detach with **Ctrl+B, D**; reattach with `tmux attach -t build`; `exit` tmux when done. Code-only changes rebuild in a minute or two because the torch, requirements and model-download layers are cached. Changing `requirements-prod.txt` or the Dockerfile reruns those layers (20–40 minutes).

The live API is unaffected until step 6.

### 6. Swap the running container

**(VM)** downtime is the model load time, about 1–2 minutes:
```bash
cd ~/ecoprompt-api
docker rm -f ecoprompt-api
docker run -d --name ecoprompt-api --restart unless-stopped --env-file .env -p 127.0.0.1:8000:8000 ecoprompt-api
docker logs -f ecoprompt-api
```
Wait for `Application startup complete.`, then **Ctrl+C** (stops the log view only).

### 7. Smoke test

Run the production checks in [api-smoke-tests.md](api-smoke-tests.md). At minimum: P1–P4 and one request through the website.

### 8. Clean up

**(VM)** once the smoke tests pass:
```bash
docker image prune -f
```
Keep `ecoprompt-api:previous` until the next deploy; it is the rollback.

### Rollback

If the new version misbehaves:
```bash
docker rm -f ecoprompt-api
docker run -d --name ecoprompt-api --restart unless-stopped --env-file .env -p 127.0.0.1:8000:8000 ecoprompt-api:previous
```
Then fix the problem locally and redeploy from step 1.

---

## Common one-off changes

### Change the API key

1. Generate a new key **(PC)**: `python -c "import secrets; print(secrets.token_urlsafe(32))"` and save it in the password manager.
2. **(VM)** `nano ~/ecoprompt-api/.env`, replace the `API_KEY=` value, save (Ctrl+O, Enter, Ctrl+X).
3. **(VM)** recreate the container (environment is read only at start):
   ```bash
   cd ~/ecoprompt-api && docker rm -f ecoprompt-api
   docker run -d --name ecoprompt-api --restart unless-stopped --env-file .env -p 127.0.0.1:8000:8000 ecoprompt-api
   ```
4. Vercel → Project → Settings → Environment Variables → update `BACKEND_API_KEY` → redeploy the website.
5. Until both are updated the website gets 401s, so do steps 3 and 4 back to back.

### Change another setting (`TORCH_THREADS`, `ALLOWED_ORIGINS`, …)

Edit `~/ecoprompt-api/.env` and recreate the container as in "Change the API key" step 3.

### Restart without changes

```bash
docker restart ecoprompt-api
```

### Check status and logs

```bash
docker ps                                   # is ecoprompt-api "Up"?
docker logs --tail 100 ecoprompt-api        # recent API output
docker stats --no-stream                    # memory/CPU use
sudo journalctl -u caddy -n 50 --no-pager   # HTTPS / certificate issues
df -h /                                     # disk space (images are large)
```

### OS updates and reboots

Ubuntu installs security updates automatically. For a full upgrade:
```bash
sudo apt update && sudo apt upgrade -y
sudo reboot        # only if it says "System restart required"
```
After a reboot, Docker restarts the container (`--restart unless-stopped`) and systemd restarts Caddy. Wait 2 minutes, then run smoke test P1.

### Disk full

Old images and build cache pile up:
```bash
docker image prune -f
docker builder prune -f      # clears build cache; the next build is slow again
```

---

## Part 2 – Rebuild the server from scratch

Use this if the VM is terminated or you move to a new one. If the public IP changes, update every `140.238.80.190` / `140-238-80-190` below, the Caddyfile, Vercel's `BACKEND_API_URL` and the UptimeRobot monitor.

### 1. Create the VM (Oracle console)

Compute → Instances → **Create instance**:
- Image: **Canonical Ubuntu 24.04**
- Shape: **Ampere → VM.Standard.A1.Flex**, 4 OCPU / 24 GB (must show "Always Free-eligible")
- Networking: new VCN + **public** subnet, **Automatically assign public IPv4 address** on
- SSH keys: **Upload public key** → `%USERPROFILE%\.ssh\oracle-ecoprompt.key.pub` (so the existing private key keeps working). If the key is lost, generate a new pair here and download the private key.
- Boot volume: 100 GB, performance Balanced

The cost estimate shows about £1.60/month for the boot volume; it ignores the free allowance (200 GB of block storage is free). Confirm £0 in Billing → Cost Analysis a day later.

If the instance shows no public IP: instance → Networking → VNIC → IP administration → private IP row → ⋮ → Edit → **Ephemeral public IP** → Update.

### 2. Open ports 80 and 443 (Oracle console)

Networking → Virtual Cloud Networks → VCN → Subnet → Security → Default Security List → **Add Ingress Rules**: source `0.0.0.0/0`, TCP, destination port `80`; another for `443`. Do not open 8000.

### 3. Connect

**(PC)** first time only, lock down the private key (the file without `.pub`):
```bat
icacls %USERPROFILE%\.ssh\oracle-ecoprompt.key /inheritance:r
icacls %USERPROFILE%\.ssh\oracle-ecoprompt.key /grant:r "%USERNAME%:R"
ssh -i %USERPROFILE%\.ssh\oracle-ecoprompt.key ubuntu@140.238.80.190
```
For a new VM on the same IP you may get "REMOTE HOST IDENTIFICATION HAS CHANGED"; fix with `ssh-keygen -R 140.238.80.190` and connect again.

### 4. Prepare the VM

**(VM)**
```bash
sudo apt update && sudo apt upgrade -y
sudo iptables -I INPUT -p tcp -m multiport --dports 80,443 -m state --state NEW -j ACCEPT
sudo netfilter-persistent save
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit
```
Reconnect, then `docker run --rm hello-world` should print "Hello from Docker!".

### 5. Copy files and build

Follow Part 1 steps 4 and 5, but first create the folder **(VM)**: `mkdir -p ~/ecoprompt-api`. Skip the `docker tag … :previous` line (there is no previous image yet). The first build takes 20–40 minutes.

### 6. Create the secrets file and run

**(VM)** with the key from the password manager:
```bash
cd ~/ecoprompt-api
printf 'APP_ENV=production\nAPI_KEY=<your production key>\nTORCH_THREADS=4\n' > .env
chmod 600 .env
docker run -d --name ecoprompt-api --restart unless-stopped --env-file .env -p 127.0.0.1:8000:8000 ecoprompt-api
docker logs -f ecoprompt-api
curl -i localhost:8000/
```

### 7. HTTPS with Caddy

**(VM)**
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
echo '140-238-80-190.sslip.io {
    reverse_proxy 127.0.0.1:8000
}' | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -n 30 --no-pager
```
Look for `certificate obtained successfully`.

### 8. Verify and reconnect everything

1. Run the full production smoke test in [api-smoke-tests.md](api-smoke-tests.md).
2. If the URL changed: update `BACKEND_API_URL` in Vercel and redeploy, and update the UptimeRobot monitor.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `WARNING: UNPROTECTED PRIVATE KEY FILE!` | Key readable by others | Rerun the `icacls` lines on the file without `.pub` |
| `Permission denied (publickey)` | Wrong key file or user | Use the private key (no `.pub`) and user `ubuntu` |
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | New VM on a known IP | `ssh-keygen -R 140.238.80.190` |
| `permission denied ... docker.sock` | Not re-logged in after adding the docker group | `exit` and reconnect |
| `container name "/ecoprompt-api" is already in use` | Old container still exists | `docker rm -f ecoprompt-api` and run again |
| Build fails during `pip install` | No wheel for ARM/Python 3.14, or a bad pin | Read the error; adjust the pin in `requirements-prod.txt` |
| Container exits on start; logs show `FileNotFoundError ... complexity_model.joblib` | Model file missing from the bundle | Check `ls ~/ecoprompt-api/artifacts`, recopy, rebuild |
| Logs mention `HF_HUB_OFFLINE` / cannot download | A model was not cached at build time | Add it to the `snapshot_download` list in the Dockerfile and rebuild |
| Logs show `ValueError: API_KEY must be set` | `.env` missing or wrong | Check `cat ~/ecoprompt-api/.env`, recreate the container |
| 502 from the HTTPS URL | Container starting or crashed | `docker ps`, `docker logs ecoprompt-api` |
| HTTPS URL hangs | Ports 80/443 blocked | Check the Oracle security list and the `iptables` rule |
| Website shows 401 errors | `API_KEY` on the VM ≠ `BACKEND_API_KEY` in Vercel | Make them match, redeploy the website |
