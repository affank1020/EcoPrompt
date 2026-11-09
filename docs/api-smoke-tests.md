# API smoke test plan

Run this after every API change or redeploy (see [api-redeploy.md](api-redeploy.md)), after VM reboots, and after rotating the API key. It confirms the API is up, protected, correct and fast enough for the website.

| Stage | When | Time |
|---|---|---|
| A. Unit tests | Before every deploy | 1 min |
| B. Production checks P1–P13 | After every deploy | 10 min |
| C. Website end-to-end | After every deploy | 5 min |
| D. Performance and resources | After dependency, model or Dockerfile changes | 10 min |

**Result:** the deploy passes only if every check marked **Must** passes. If one fails, roll back (`api-redeploy.md` → Rollback) and investigate.

---

## Setup

- **Base URL:** `https://140-238-80-190.sslip.io`
- **API key:** from the password manager. Below it is written `<KEY>`.
- **Postman (optional):** an environment with `baseUrl` and `apiKey` (secret), and a collection whose Authorization is *API Key*, key `X-API-Key`, value `{{apiKey}}`, added to the header. Every request below can be built from it.
- **curl:** the commands below are for Windows cmd (escaped double quotes).
- **Logs:** keep an SSH session open on the VM with `docker logs -f ecoprompt-api` to spot errors while testing.

---

## A. Unit tests (local, before deploying)

**(PC)** from `backend\` with the venv active:
```bat
python -m unittest test_api test_joint_classifier -v
```
**Must:** all tests pass. These mock the models, so they check the HTTP contract, validation, CORS and API key handling, not model output.

---

## B. Production checks

### Availability and security

| ID | Must | Check | Request | Expected |
|---|---|---|---|---|
| P1 | Must | Health | `GET /` | `200`, `{"message":"Hello, World!"}` |
| P2 | Must | HTTPS certificate is valid | `GET /` (no `-k`/insecure flag) | No certificate error |
| P3 | Must | Missing key rejected | `POST /analyse` with no `X-API-Key` | `401`, `{"detail":"Invalid or missing API key"}` |
| P4 | Must | Wrong key rejected | `POST /analyse` with `X-API-Key: wrong` | `401` |
| P5 | Must | Missing key rejected on every endpoint | `POST /analyse/bulk` and `POST /compress` without key | `401` for both |
| P6 | Must | Internal port not exposed | `http://140.238.80.190:8000/` | Connection fails or times out |

```bat
curl -i https://140-238-80-190.sslip.io/
curl -i -X POST https://140-238-80-190.sslip.io/analyse -H "Content-Type: application/json" -d "{\"prompt\":\"hi\"}"
curl -i -X POST https://140-238-80-190.sslip.io/analyse -H "Content-Type: application/json" -H "X-API-Key: wrong" -d "{\"prompt\":\"hi\"}"
curl -i -X POST https://140-238-80-190.sslip.io/analyse/bulk -H "Content-Type: application/json" -d "{\"prompts\":[\"hi\"]}"
curl -i -X POST https://140-238-80-190.sslip.io/compress -H "Content-Type: application/json" -d "{\"prompt\":\"hello world\"}"
curl -i --max-time 10 http://140.238.80.190:8000/
```

### Analyse

| ID | Must | Check | Body for `POST /analyse` | Expected |
|---|---|---|---|---|
| P7 | Must | Valid response shape | `{"prompt":"What is the capital of France?"}` | `200`; `label` is `easy`/`medium`/`hard`; `probabilities` has all three keys summing to ≈1; `tokens` > 0; `water_cost` and `energy_cost` > 0 |
| P8 | Should | Labels spread sensibly | The easy, medium and hard prompts below | The easy prompt is not `hard` and the hard prompt is not `easy` |
| P9 | Should | Both models are live | Same prompt with `"epsilon": 1` and `"epsilon": 0` | Both `200`; `probabilities` differ between the two (if identical, one model is not being used) |

Prompts:
- Easy: `What is the capital of France?`
- Medium: `Write a Python function that checks whether a string is a palindrome, ignoring spaces and punctuation, and explain how it works.`
- Hard: `Design a distributed rate limiter for an API gateway handling 1 million requests per second across multiple regions. Compare token bucket and sliding window approaches, explain how you would keep counters consistent across regions, and discuss the trade-offs between accuracy, latency and cost.`

```bat
curl -s -X POST https://140-238-80-190.sslip.io/analyse -H "Content-Type: application/json" -H "X-API-Key: <KEY>" -d "{\"prompt\":\"What is the capital of France?\"}"
curl -s -X POST https://140-238-80-190.sslip.io/analyse -H "Content-Type: application/json" -H "X-API-Key: <KEY>" -d "{\"prompt\":\"Explain quantum entanglement to a 10 year old.\",\"epsilon\":1}"
curl -s -X POST https://140-238-80-190.sslip.io/analyse -H "Content-Type: application/json" -H "X-API-Key: <KEY>" -d "{\"prompt\":\"Explain quantum entanglement to a 10 year old.\",\"epsilon\":0}"
```

Record the labels for the three reference prompts in the results log. A label change between deploys is not automatically a failure, but if nothing in the models changed, it is a sign something did.

### Bulk

| ID | Must | Check | Body for `POST /analyse/bulk` | Expected |
|---|---|---|---|---|
| P10 | Must | Order and count | The four-prompt body below | `200`; `count` is 4; `results[i].prompt` equals `prompts[i]` for every i; each result has the same fields as P7 |

```json
{
  "prompts": [
    "hi",
    "Translate 'good morning' into Spanish.",
    "Summarise the main causes of the First World War in three paragraphs.",
    "Prove that there are infinitely many prime numbers, then generalise the argument to primes of the form 4k+3."
  ],
  "epsilon": 0.5
}
```

### Compress

| ID | Must | Check | Body for `POST /compress` | Expected |
|---|---|---|---|---|
| P11 | Must | Compresses a wordy prompt | Wordy prompt below, `"preset":"balanced"` | `200`; `reason` is `ok`; `fallback` false; `tokens_after` < `tokens_before`; `tokens_saved` = `tokens_before − tokens_after` |
| P12 | Must | Protects negations and numbers | Negation prompt below, `"preset":"aggressive"` | `200`; **either** the compressed text still contains "not", "50" and "3", **or** `fallback` is true, `reason` is `verification_failed` and `compressed` equals the original |
| P13 | Should | Short prompt left alone | `{"prompt":"Hello there","preset":"balanced"}` | `200`; `fallback` true; `reason` is `too_short` or `no_savings`; `tokens_saved` 0 |

Prompts:
- Wordy: `Hi there! I was just wondering if you could possibly help me out by writing a really short and friendly email to my neighbour about the noise from their party last night. It honestly was not a huge problem at all, but I would just like to politely mention it so it does not happen again.`
- Negation: `Please do not include any prices above 50 pounds, and list exactly 3 options for a birthday gift for my 12 year old nephew who likes football.`

Also try the wordy prompt with `light` and `aggressive`: `tokens_saved` should generally go `light` ≤ `balanced` ≤ `aggressive`.

### Validation

Send these **with** the key (without it you get 401 before validation runs).

| ID | Must | Request | Expected |
|---|---|---|---|
| V1 | Must | `POST /analyse` `{"prompt":"   "}` | `422` |
| V2 | Must | `POST /analyse` `{"prompt":"hi","epsilon":2}` | `422` |
| V3 | Must | `POST /analyse/bulk` `{"prompts":[]}` | `422` |
| V4 | Should | `POST /analyse/bulk` with 201 prompts | `422` |
| V5 | Must | `POST /compress` `{"prompt":"hello world","preset":"extreme"}` | `422` |
| V6 | Should | `POST /analyse` with malformed JSON `{"prompt":` | `422` |

**Must:** none of these return `500`.

### Logs

| ID | Must | Check | Expected |
|---|---|---|---|
| L1 | Must | `docker logs --tail 100 ecoprompt-api` after the tests | No tracebacks; no prompt text logged (compression lines show only preset, reason, ms and token counts) |
| L2 | Must | `docker ps` | `ecoprompt-api` is `Up` and has not restarted since the deploy (check `docker inspect -f '{{.RestartCount}}' ecoprompt-api` is `0`) |

---

## C. Website end-to-end

On the production website (logged in):

| ID | Must | Check | Expected |
|---|---|---|---|
| W1 | Must | Prompt checker with a normal prompt | Result shows; methodology label is the backend one, **not** "Illustrative website mock estimate" |
| W2 | Must | Compression panel on a wordy prompt | Shows backend compression with token counts, not "Local mock compressor" |
| W3 | Must | Bulk check with 3–5 prompts | All results return, in order |
| W4 | Should | Dashboard → History | The checks from W1–W3 appear |
| W5 | Must | Vercel → Project → Logs | No `Analysis API returned 401` / `5xx` errors |

A mock label in W1 or W2 means `BACKEND_API_URL` is not set in Vercel. 401 errors mean `BACKEND_API_KEY` doesn't match the VM's `API_KEY`.

---

## D. Performance and resources

Run after changes to dependencies, models, the Dockerfile or `TORCH_THREADS`.

| ID | Must | Check | Expected |
|---|---|---|---|
| R1 | Must | Time for one `/analyse` (use `curl -w "%{time_total}\n" -o NUL -s ...`, or Postman's time) | Under 10 s (website timeout: 60 s). Record it. |
| R2 | Must | `/compress` on the wordy prompt | Under 10 s (website timeout: 60 s) |
| R3 | Should | `/analyse/bulk` with 20 prompts | Record the time and divide by 20; the website's bulk timeout is 180 s, so seconds-per-prompt × the largest batch you expect must stay well under that |
| R4 | Must | `docker stats --no-stream` on the VM after the tests | Memory well under the VM's 24 GB; record it |
| R5 | Should | `df -h /` on the VM | Under 80% used; otherwise prune images (see runbook) |
| R6 | Must | `docker restart ecoprompt-api`, wait 2 minutes, repeat P1 and P7 | Both pass (the API recovers from a restart) |

---

## Results log

Copy this block into the PR description or a team note each time:

```
API smoke test – <date> – <git commit> – <who>
A  Unit tests:          pass/fail
B  P1–P13:              pass/fail (failures: …)
   Labels easy/med/hard: … / … / …
   V1–V6, L1–L2:        pass/fail
C  W1–W5:               pass/fail
D  R1 analyse: … s   R2 compress: … s   R3 bulk(20): … s   R4 memory: … GB
Result: PASS / FAIL (rolled back? y/n)
```
