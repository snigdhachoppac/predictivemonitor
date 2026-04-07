import json
import time
import random
from datetime import datetime
from kafka import KafkaProducer

producer = KafkaProducer(bootstrap_servers='localhost:9092', value_serializer=lambda v: json.dumps(v).encode('utf-8'))

def generate_metric(failure_mode=False):
    base = {"timestamp": datetime.utcnow().isoformat(), "cpu_percent": random.gauss(35, 5), "memory_percent": random.gauss(45, 5), "latency_ms": random.gauss(120, 15), "error_rate": random.gauss(0.01, 0.005), "db_connections": random.gauss(20, 3), "requests_per_sec": random.gauss(200, 20)}
    if failure_mode:
        base["cpu_percent"] += random.gauss(30, 5)
        base["memory_percent"] += random.gauss(25, 3)
        base["latency_ms"] += random.gauss(200, 30)
        base["error_rate"] += random.gauss(0.08, 0.02)
        base["db_connections"] += random.gauss(40, 5)
    base["cpu_percent"] = max(0, min(100, base["cpu_percent"]))
    base["memory_percent"] = max(0, min(100, base["memory_percent"]))
    base["latency_ms"] = max(10, base["latency_ms"])
    base["error_rate"] = max(0, base["error_rate"])
    base["db_connections"] = max(1, base["db_connections"])
    return base

print("🚀 Simulator running...")
start = time.time()
while True:
    failure_mode = (time.time() - start) > 120
    metric = generate_metric(failure_mode)
    producer.send('system-metrics', metric)
    print(f"[{'⚠️ FAILURE' if failure_mode else '✅ healthy'}] CPU: {metric['cpu_percent']:.1f}%")
    time.sleep(1)
