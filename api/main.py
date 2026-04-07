from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis
import json
import anthropic
import os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

@app.get("/prediction")
def get_prediction():
    data = r.get("latest_prediction")
    return json.loads(data) if data else {"error": "no data yet"}

@app.get("/history")
def get_history():
    items = r.lrange("prediction_history", 0, 49)
    return [json.loads(i) for i in items]

@app.get("/shap")
def get_shap():
    data = r.get("latest_shap")
    return json.loads(data) if data else {"error": "no shap data yet"}

@app.get("/alerts")
def get_alerts():
    items = r.lrange("alert_history", 0, 19)
    return [json.loads(i) for i in items]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/runbook")
def get_runbook():
    data = r.get("latest_prediction")
    if not data:
        return {"error": "no data yet"}
    prediction = json.loads(data)
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    prompt = f"""You are an expert SRE. A monitoring system detected a potential failure.

Current metrics:
- Risk Score: {prediction['risk_score']}%
- CPU: {prediction['cpu']}%
- Memory: {prediction['memory']}%
- Latency: {prediction['latency']}ms
- Error Rate: {prediction['error_rate']}
- Anomaly Detected: {'Yes' if prediction['is_anomaly'] else 'No'}

Provide:
1. Likely root cause (1-2 sentences)
2. Immediate actions (3 bullet points)
3. Escalation threshold

Keep it short and actionable. Plain text only."""
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}]
    )
    return {"runbook": message.content[0].text, "risk_score": prediction['risk_score'], "generated_at": prediction['timestamp']}
