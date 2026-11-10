import sys, json, wave, glob, numpy as np, sherpa_onnx as s
D = glob.glob(sys.argv[1] + "/sherpa*")[0]
m = s.OfflineTtsSupertonicModelConfig(duration_predictor=f"{D}/duration_predictor.int8.onnx", text_encoder=f"{D}/text_encoder.int8.onnx",
    vector_estimator=f"{D}/vector_estimator.int8.onnx", vocoder=f"{D}/vocoder.int8.onnx", tts_json=f"{D}/tts.json",
    unicode_indexer=f"{D}/unicode_indexer.bin", voice_style=f"{D}/voice.bin")
cfg = s.OfflineTtsConfig(model=s.OfflineTtsModelConfig(supertonic=m, num_threads=4))
tts = s.OfflineTts(cfg)
lines = json.load(open(sys.argv[2]))
for i, (sid, speed, text) in enumerate(lines):
    g = s.GenerationConfig(); g.sid = sid; g.speed = speed; g.num_steps = 16; g.extra = {"lang": "ko"}
    a = tts.generate(text, g)
    x = (np.clip(np.array(a.samples), -1, 1) * 32767).astype(np.int16)
    with wave.open(f"{sys.argv[3]}/l{i}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(a.sample_rate); w.writeframes(x.tobytes())
    print(i, sid, round(len(x) / a.sample_rate, 2))
