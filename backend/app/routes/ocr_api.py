from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..ai.ocr.ocr_engine_easy import run_easy_ocr
from ..ai.ocr.ocr_parser import parse_receipt

bp = Blueprint("ocr_api", __name__, url_prefix="/api/ocr")

@bp.post("/receipt")
@jwt_required()
def ocr_receipt():
    if "file" not in request.files:
        return jsonify({"success": False, "message": "Missing file"}), 400

    img_bytes = request.files["file"].read()

    # OCR bằng EasyOCR
    lines = run_easy_ocr(img_bytes)

    # NLP trích xuất thông tin
    parsed = parse_receipt(lines)

    return jsonify({
        "success": True,
        "raw_lines": lines,
        **parsed
    })
