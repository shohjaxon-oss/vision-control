import os
import cv2
import numpy as np
from typing import List, Tuple, Dict, Any, Optional

class FaceEngine:
    """
    OpenCV YuNet (Face Detection & 5-point Landmarks) + SFace (Feature Embedding)
    100% compliant with Apache 2.0 commercial license.
    Zero fake random embeddings!
    """
    def __init__(
        self,
        yunet_model: str = "face_detection_yunet_2023mar.onnx",
        sface_model: str = "face_recognition_sface_2021dec.onnx"
    ):
        self.yunet_path = yunet_model
        self.sface_path = sface_model
        self.detector: Optional[cv2.FaceDetectorYN] = None
        self.recognizer: Optional[cv2.FaceRecognizerSF] = None
        self.init_models()

    def init_models(self):
        if os.path.exists(self.yunet_path):
            self.detector = cv2.FaceDetectorYN.create(
                model=self.yunet_path,
                config="",
                input_size=(320, 320),
                score_threshold=0.8,
                nms_threshold=0.3,
                top_k=5000
            )
        if os.path.exists(self.sface_path):
            self.recognizer = cv2.FaceRecognizerSF.create(
                model=self.sface_path,
                config=""
            )

    def is_ready(self) -> bool:
        return self.detector is not None and self.recognizer is not None

    def assess_quality(self, image: np.ndarray, face_box: np.ndarray) -> Tuple[bool, List[str]]:
        """
        Genuine Quality Assessment:
        - Resolution check (min 60x60 pixels)
        - Blur detection via Laplacian variance
        - Illumination check via grayscale mean
        - Pose estimation from YuNet 5 landmarks
        """
        issues = []
        x, y, w, h = int(face_box[0]), int(face_box[1]), int(face_box[2]), int(face_box[3])
        
        # 1. Size check
        if w < 60 or h < 60:
            issues.append(f"Yuz o'lchami juda kichik ({w}x{h}px, minimal 60x60px)")

        # Crop face bounds safely
        img_h, img_w = image.shape[:2]
        x1, y1 = max(0, x), max(0, y)
        x2, y2 = min(img_w, x + w), min(img_h, y + h)
        crop = image[y1:y2, x1:x2]
        if crop.size == 0:
            return False, ["Kadr chegarasidan tashqarida"]

        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if len(crop.shape) == 3 else crop

        # 2. Blur / Sharpness check (Laplacian variance)
        blur_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if blur_var < 80.0:
            issues.append(f"Rasm xira (fokus yetarli emas: {blur_var:.1f})")

        # 3. Illumination check
        mean_brightness = float(np.mean(gray))
        if mean_brightness < 45.0:
            issues.append(f"Rasm o'ta qorong'i (yorug'lik darajasi: {mean_brightness:.1f})")
        elif mean_brightness > 225.0:
            issues.append(f"Rasm o'ta yorug' (ko'rinarli yorqinlik: {mean_brightness:.1f})")

        # 4. Pose estimation from landmarks (face_box has [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rc, y_rc, x_lc, y_lc, score])
        if len(face_box) >= 14:
            r_eye_x, r_eye_y = face_box[4], face_box[5]
            l_eye_x, l_eye_y = face_box[6], face_box[7]
            nose_x = face_box[8]
            
            # Yaw estimation: nose position relative to eye midpoint
            eye_mid_x = (r_eye_x + l_eye_x) / 2.0
            eye_dist = abs(l_eye_x - r_eye_x)
            if eye_dist > 0:
                yaw_ratio = abs(nose_x - eye_mid_x) / eye_dist
                if yaw_ratio > 0.40:
                    issues.append("Yuz burchagi qiyshiq (burilish burchagi > 20°)")

        return len(issues) == 0, issues

    def detect_and_align(self, image: np.ndarray) -> List[Tuple[np.ndarray, np.ndarray, float]]:
        """
        Detects faces, aligns them via FaceRecognizerSF.alignCrop.
        Returns list of (aligned_face, face_info, score)
        """
        if image is None or self.detector is None:
            return []

        h, w = image.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(image)
        if faces is None:
            return []

        results = []
        for face in faces:
            score = float(face[-1])
            if self.recognizer is not None:
                aligned = self.recognizer.alignCrop(image, face)
                results.append((aligned, face, score))
            else:
                results.append((None, face, score))
        return results

    def extract_feature(self, aligned_face: np.ndarray) -> np.ndarray:
        """
        Extracts genuine 128-d facial embedding vector.
        If recognizer is not initialized, raises RuntimeError. No random fallback!
        """
        if self.recognizer is None or aligned_face is None:
            raise RuntimeError("Face recognition model (SFace) is not initialized. Cannot generate biometric embedding!")
        
        feature = self.recognizer.feature(aligned_face)
        v = feature[0]
        norm = np.linalg.norm(v)
        if norm > 0:
            v = v / norm
        return v

    @staticmethod
    def match_cosine(feat1: np.ndarray, feat2: np.ndarray) -> float:
        """
        Cosine similarity between two normalized 128-d embeddings.
        Threshold ~ 0.363 for SFace
        """
        dot = float(np.dot(feat1, feat2))
        norm = float(np.linalg.norm(feat1) * np.linalg.norm(feat2))
        return dot / norm if norm > 0 else 0.0
