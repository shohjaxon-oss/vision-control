import os
import cv2
import numpy as np
from typing import Tuple, Optional

class MiniFASNetLiveness:
    """
    MiniFASNet Anti-Spoofing Model.
    If ONNX model is available on disk, runs ONNX session inference.
    If model is missing, returns status='disabled' (zero fake scores, explicit warning).
    """
    def __init__(self, model_path: Optional[str] = "2.7_80x80_MiniFASNetV2.onnx"):
        self.model_path = model_path
        self.session = None
        self.is_enabled = False
        self.threshold = 0.85
        self.init_model()

    def init_model(self):
        if self.model_path and os.path.exists(self.model_path):
            try:
                import onnxruntime as ort
                self.session = ort.InferenceSession(self.model_path)
                self.is_enabled = True
            except Exception as e:
                print(f"[MiniFASNetLiveness] Modelni yuklashda xatolik: {e}. Liveness o'chirilgan holatda ishlaydi.")
                self.is_enabled = False
        else:
            self.is_enabled = False

    def check_liveness(self, face_crop: np.ndarray) -> Tuple[bool, float, str]:
        """
        Evaluates face liveness.
        Returns: (is_live: bool, confidence: float, status: 'verified' | 'spoof' | 'disabled')
        """
        if not self.is_enabled or self.session is None:
            # Model is absent -> explicit disabled status, no fabricated score!
            return False, 0.0, "disabled"

        if face_crop is None or face_crop.size == 0:
            return False, 0.0, "invalid_crop"

        try:
            # Preprocessing for 80x80 MiniFASNet
            resized = cv2.resize(face_crop, (80, 80))
            img = resized.astype(np.float32)
            img = np.transpose(img, (2, 0, 1)) # HWC to CHW
            img = np.expand_dims(img, axis=0)  # Add batch dim

            input_name = self.session.get_inputs()[0].name
            outputs = self.session.run(None, {input_name: img})
            # Softmax on output logits
            logits = outputs[0][0]
            exp_logits = np.exp(logits - np.max(logits))
            probs = exp_logits / np.sum(exp_logits)
            
            # Index 1 is real face in MiniFASNet binary classification
            real_score = float(probs[1]) if len(probs) > 1 else float(probs[0])
            is_live = real_score >= self.threshold
            status_str = "verified" if is_live else "spoof"
            return is_live, round(real_score, 4), status_str
        except Exception as e:
            return False, 0.0, "error"
