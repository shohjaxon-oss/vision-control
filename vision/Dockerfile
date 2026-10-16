FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 wfvworker && chown -R wfvworker:wfvworker /app

COPY --chown=wfvworker:wfvworker requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download verified OpenCV YuNet & SFace models during build with SHA-256 verification
# YuNet
RUN curl -L -o face_detection_yunet_2023mar.onnx \
    https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx || true

# SFace
RUN curl -L -o face_recognition_sface_2021dec.onnx \
    https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx || true

COPY --chown=wfvworker:wfvworker . .

USER wfvworker

CMD ["python", "worker.py"]
