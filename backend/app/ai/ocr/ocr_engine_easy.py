import easyocr
import numpy as np
from PIL import Image
from io import BytesIO
import cv2

# EasyOCR hỗ trợ EN + VI
reader = easyocr.Reader(['vi', 'en'])


def run_easy_ocr(img_bytes: bytes):
    """
    Nhận dạng chữ trên hóa đơn bằng EasyOCR.
    Trả về list dòng text theo thứ tự từ trên xuống dưới.
    """

    # Load ảnh
    img = Image.open(BytesIO(img_bytes)).convert("RGB")
    img_np = np.array(img)

    # Chạy OCR
    result = reader.readtext(img_np, detail=1)

    # result = [ [bbox, text, score], ... ]

    # Sắp xếp theo y → x (giữ thứ tự dòng)
    def sort_key(item):
        pts = item[0]   # bbox
        y = min(p[1] for p in pts)
        x = min(p[0] for p in pts)
        return (y, x)

    result_sorted = sorted(result, key=sort_key)

    lines = [item[1] for item in result_sorted]
    return lines
