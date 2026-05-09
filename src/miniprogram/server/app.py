"""
Flask 测试服务器 - 保险查勘助手后端
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import onnxruntime as ort
import numpy as np
from PIL import Image
import io
import os

app = Flask(__name__)
CORS(app)

# ========== 加载模型 ==========
MODEL_PATH = r"model\best_int8.onnx"

print("=" * 60)
print("保险查勘助手 - 测试服务器启动中...")
print(f"模型路径: {MODEL_PATH}")

if not os.path.exists(MODEL_PATH):
    print(f"❌ 错误：找不到模型文件！")
    exit(1)

session = ort.InferenceSession(MODEL_PATH)
input_name = session.get_inputs()[0].name
print(f"✅ 模型加载成功")
print(f"   输入形状: {session.get_inputs()[0].shape}")
print(f"   输出形状: {session.get_outputs()[0].shape}")
print("=" * 60)

def preprocess_image(image_data):
    img = Image.open(io.BytesIO(image_data)).convert('RGB')
    img = img.resize((640, 640))
    img_array = np.array(img).astype(np.float32)
    img_array = img_array.transpose(2, 0, 1) / 255.0
    return np.expand_dims(img_array, axis=0)

def postprocess_output(output, conf_threshold=0.5):
    predictions = output[0]
    boxes = []
    max_confidence = 0.0
    
    for pred in predictions:
        confidence = float(pred[4])
        if confidence > conf_threshold:
            boxes.append({
                'x': float(pred[0]),
                'y': float(pred[1]),
                'w': float(pred[2]),
                'h': float(pred[3]),
                'confidence': round(confidence, 4),
                'class': int(pred[5])
            })
            if confidence > max_confidence:
                max_confidence = confidence
    
    is_accident = max_confidence > 0.7
    return is_accident, max_confidence, boxes

@app.route('/detect', methods=['POST'])
def detect():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400
    
    file = request.files['image']
    
    try:
        image_data = file.read()
        input_data = preprocess_image(image_data)
        outputs = session.run(None, {input_name: input_data})
        is_accident, confidence, boxes = postprocess_output(outputs[0])
        
        return jsonify({
            'success': True,
            'isAccident': is_accident,
            'confidence': round(float(confidence), 4),
            'boxes': boxes[:5],
            'message': '检测完成'
        })
        
    except Exception as e:
        print(f"推理错误: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'running',
        'model': 'best_int8.onnx',
        'model_size_mb': round(os.path.getsize(MODEL_PATH) / 1024 / 1024, 2)
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)