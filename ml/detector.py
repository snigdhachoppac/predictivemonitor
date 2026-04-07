import json
import redis
import numpy as np
import shap
from kafka import KafkaConsumer
from sklearn.ensemble import IsolationForest
from collections import deque
from datetime import datetime

r = redis.Redis(host='localhost', port=6379, decode_responses=True)
consumer = KafkaConsumer('system-metrics', bootstrap_servers='localhost:9092', value_deserializer=lambda v: json.loads(v.decode('utf-8')))
buffer = deque(maxlen=50)
model = IsolationForest(contamination=0.1, random_state=42)
trained = False
explainer = None
FEATURES = ['cpu_percent','memory_percent','latency_ms','error_rate','db_connections','requests_per_sec']
FEATURE_LABELS = ['CPU','Memory','Latency','Error Rate','DB Connections','Requests/s']

print("🧠 Anomaly detector listening...\n")
for message in consumer:
    metric = message.value
    row = [metric[f] for f in FEATURES]
    buffer.append(row)

    if len(buffer) >= 30 and not trained:
        model.fit(list(buffer))
        explainer = shap.Explainer(model.score_samples, np.array(list(buffer)), feature_names=FEATURE_LABELS)
        trained = True
        print("✅ Model + SHAP explainer ready!\n")

    if trained:
        score = model.decision_function([row])[0]
        prediction = model.predict([row])[0]
        risk = max(0, min(100, int((1 - (score + 0.5)) * 100)))

        # SHAP values
        shap_values = explainer(np.array([row])).values[0]
        shap_data = {FEATURE_LABELS[i]: round(float(shap_values[i]), 4) for i in range(len(FEATURE_LABELS))}

        result = {
            "timestamp": metric["timestamp"],
            "risk_score": risk,
            "is_anomaly": int(prediction == -1),
            "cpu": round(metric["cpu_percent"], 1),
            "memory": round(metric["memory_percent"], 1),
            "latency": round(metric["latency_ms"], 1),
            "error_rate": round(metric["error_rate"], 4),
            "db_connections": round(metric["db_connections"], 1),
            "requests_per_sec": round(metric["requests_per_sec"], 1),
        }

        r.setex("latest_prediction", 60, json.dumps(result))
        r.setex("latest_shap", 60, json.dumps(shap_data))
        r.lpush("prediction_history", json.dumps(result))
        r.ltrim("prediction_history", 0, 99)

        # Save alerts
        if prediction == -1:
            alert = {"timestamp": metric["timestamp"], "risk_score": risk, "cpu": result["cpu"], "latency": result["latency"], "error_rate": result["error_rate"], "shap": shap_data}
            r.lpush("alert_history", json.dumps(alert))
            r.ltrim("alert_history", 0, 19)

        status = "🚨 ANOMALY" if prediction == -1 else "✅ normal"
        print(f"[{status}] Risk: {risk}% | CPU: {result['cpu']}%")
