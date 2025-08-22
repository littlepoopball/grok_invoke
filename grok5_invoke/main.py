import logging
from logging.handlers import RotatingFileHandler
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Dict, Any
from openai import AsyncOpenAI
import os
from dotenv import load_dotenv
import json
import httpx
import base64
import asyncio

# 设置日志
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
console_handler.encoding = 'utf-8'
logger.addHandler(console_handler)
file_handler = RotatingFileHandler('app.log', maxBytes=5*1024*1024, backupCount=3, encoding='utf-8')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# 初始化 FastAPI
app = FastAPI()

# 动态 CORS 配置
ENV = os.getenv("ENV", "development")
ALLOWED_ORIGINS = (
    ["http://localhost:3000", "http://localhost:5173"]
    if ENV == "development"
    else ["https://your-production-domain.com"]  # 替换为生产域名
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)

# 加载 .env 文件（动态路径）
dotenv_path = os.getenv("DOTENV_PATH", "D:\\jiayi\\grok5\\.env")
load_dotenv(dotenv_path=dotenv_path)
api_key = os.getenv("GROK_API_KEY")
if not api_key:
    error_msg = f"未找到 API 密钥。请在 {dotenv_path} 中设置 GROK_API_KEY 或从 https://console.x.ai 获取新密钥。"
    logger.error(error_msg)
    raise ValueError(error_msg)
else:
    logger.info("API 密钥加载成功")

# 初始化 OpenAI 异步客户端
client = AsyncOpenAI(
    api_key=api_key,
    base_url="https://api.x.ai/v1/",
    http_client=httpx.AsyncClient(
        proxy=None,
        timeout=30.0,  # 增加超时时间
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),  # 支持高并发
    ),
)

# Pydantic 模型
class ChatRequest(BaseModel):
    user_input: str
    expert_type: str
    session_id: str | None = None
    history: List[Dict[str, str]] = []
    form_data: Dict[str, Any] | None = None

    @validator("expert_type")
    def validate_expert_type(cls, v):
        if v.lower() not in ["medical", "insurance"]:
            raise ValueError("expert_type 必须为 'medical' 或 'insurance'")
        return v.lower()

class ChatResponse(BaseModel):
    response: str
    status: str = "success"
    error: str | None = None

class UploadResponse(BaseModel):
    response: str
    status: str = "success"
    error: str | None = None

# 系统提示
MEDICAL_SYSTEM_PROMPT = """
你是一位经验丰富的全科医生，擅长通过对话进行精准诊断，语气温暖、专业且富有同理心：
1. 每次只提出一个具体、引导性的问题，基于用户提供的信息，例如：“您提到头痛，请问是持续性疼痛还是间歇性发作？”
2. 根据用户提供的信息，逐步分析并排除可能的疾病，明确说明排除理由，例如：“您没有发热或咳嗽，暂时排除流感可能性。”
3. 如果信息不足，仅提出一个简洁、针对性的问题，确保与用户情况高度相关。
4. 收集足够信息后，提供初步诊断，详细说明推理过程，例如：“根据您的喉咙痛、发热3天且无咳嗽，可能是细菌性咽炎，建议进行咽拭子检查。”
5. 诊断后，推荐具体后续步骤，个性化建议，例如：“考虑到您是年轻人且无慢性病史，建议多喝水并观察2天。”
6. 参考对话历史，确保诊断和问题连贯，避免重复提问。
7. 如果用户提交问卷，优先分析问卷信息，结合对话补充细节，生成个性化诊断。
8. 语气亲切，鼓励用户提供更多细节，例如：“别担心，我们一步步分析，请告诉我更多症状细节。”
9. 每次对话提供一个小建议（如“保持充足睡眠有助于恢复”），增强用户信任感和收获感。
10. 回复使用 Markdown 格式，结构清晰，例如：
    ### 推荐诊断
    上呼吸道感染
    ### 诊断理由
    您的咳嗽和发热持续3天，无其他严重症状。
    ### 建议
    - 多休息，保持水分摄入。
    - 监测体温，如持续高烧请就医。
    ### 后续问题
    您的咳嗽是否有痰？痰的颜色和性状如何？
"""

INSURANCE_SYSTEM_PROMPT = """
你是一位专业的保险与资产配置顾问，擅长为用户量身定制保险和投资方案，语气专业、简洁且用户友好：
1. 如果用户提交JSON问卷，分析年龄、收入、健康状况、保险需求和风险承受能力，提出1-2个针对性问题，挖掘用户需求（如预算、家庭情况、保障期限、投资偏好），避免直接给出最终推荐。
2. 仅在至少2轮交互后（问卷+用户回答），提供定制化建议，包含：
   - 推荐保险产品组合（如意外险+储蓄型保险）。
   - 保费估算和覆盖范围。
   - 资产配置建议（如“建议30%收入用于保障型保险，20%投资低风险基金”）。
   - 资产配置专业知识（如“根据生命周期理论，年轻时优先高性价比保障，逐步增加储蓄型产品”）。
3. 如果用户未提交问卷或输入无效，提出一个关键问题，例如：“请问您的年龄范围和保险预算？这些信息有助于定制方案。”
4. 每次对话提供一个小建议（如“定期审视保险计划可确保覆盖需求”），增强用户信任感和收获感。
5. 建议和问题使用 Markdown 格式，结构清晰，例如：
    ### 问卷分析
    您的信息显示您为年轻人士，年收入20万元，健康状况良好，倾向意外保险。
    ### 后续问题
    1. 您的年度保险预算是多少？
    2. 您是否有需要保障的家庭成员（如父母或子女）？
6. 参考对话历史，确保建议连贯，体现定制化。
7. 语气专业且亲切，增强用户信任感，例如：“让我们一起规划适合您的保障方案。”
"""

def parse_form_data(form_data: Dict[str, Any], expert_type: str) -> tuple[str, bool]:
    """格式化问卷数据为 Markdown 格式，并验证完整性"""
    if not form_data:
        return "", False

    logger.debug(f"解析问卷数据: {form_data}")
    required_fields = (
        ["age", "gender", "symptoms", "duration", "medical_history"]
        if expert_type == "medical"
        else ["age", "income", "health_conditions", "insurance_needs", "risk"]
    )
    is_complete = all(form_data.get(field) not in [None, "", "未知"] for field in required_fields)

    if expert_type == "medical":
        if not is_complete:
            return (
                "### 问卷信息不完整\n请补充以下信息：\n"
                f"- **年龄**: {form_data.get('age', '未知')}岁\n"
                f"- **性别**: {form_data.get('gender', '未知')}\n"
                f"- **主要症状**: {form_data.get('symptoms', '未知')}\n"
                f"- **症状持续时间**: {form_data.get('duration', '未知')}\n"
                f"- **既往病史**: {form_data.get('medical_history', '未知')}\n"
                "### 后续问题\n请提供详细的症状描述或既往病史。",
                False,
            )
        return (
            "## 患者问卷信息\n"
            f"- **年龄**: {form_data.get('age', '未知')}岁\n"
            f"- **性别**: {form_data.get('gender', '未知')}\n"
            f"- **主要症状**: {form_data.get('symptoms', '未知')}\n"
            f"- **症状持续时间**: {form_data.get('duration', '未知')}\n"
            f"- **既往病史**: {form_data.get('medical_history', '未知')}\n"
            "### 小建议\n定期体检有助于早期发现健康问题。",
            True,
        )
    else:  # insurance
        if not is_complete:
            return (
                "### 问卷信息不完整\n请补充以下信息：\n"
                f"- **年龄**: {form_data.get('age', '未知')}岁\n"
                f"- **年收入**: {form_data.get('income', '未知')}元\n"
                f"- **健康状况**: {form_data.get('health_conditions', '未知')}\n"
                f"- **保险需求**: {form_data.get('insurance_needs', '未知')}\n"
                f"- **风险承受能力**: {form_data.get('risk', '未知')}\n"
                "### 后续问题\n请提供您的保险预算或家庭成员保障需求。",
                False,
            )
        return (
            "## 客户问卷信息\n"
            f"- **年龄**: {form_data.get('age', '未知')}岁\n"
            f"- **年收入**: {form_data.get('income', '未知')}元\n"
            f"- **健康状况**: {form_data.get('health_conditions', '未知')}\n"
            f"- **保险需求**: {form_data.get('insurance_needs', '未知')}\n"
            f"- **风险承受能力**: {form_data.get('risk', '未知')}\n"
            "### 小建议\n定期审视保险计划，确保覆盖您的最新需求。",
            True,
        )

@app.options("/api/chat")
async def options_chat():
    logger.info("收到 /api/chat OPTIONS 请求")
    return {"status": "ok"}

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    logger.debug(f"收到 /api/chat POST 请求: {request.model_dump_json(indent=2)}")
    logger.info(f"专家类型: {request.expert_type}, 系统提示: {'医疗' if request.expert_type == 'medical' else '保险'}")

    try:
        # 验证请求体
        if not request.user_input.strip() and not request.form_data:
            logger.warning("空输入请求")
            return ChatResponse(
                response="### 错误提示\n请输入有效的问题或问卷信息。",
                status="error",
                error="空输入",
            )

        # 选择系统提示
        system_prompt = MEDICAL_SYSTEM_PROMPT if request.expert_type == "medical" else INSURANCE_SYSTEM_PROMPT

        # 解析问卷数据
        form_content, is_form_complete = parse_form_data(request.form_data, request.expert_type)
        user_message = request.user_input.strip()
        if request.expert_type == "insurance" and user_message in ["传递", "", " "]:
            if not is_form_complete:
                logger.warning("保险专家收到无效输入或不完整问卷")
                return ChatResponse(
                    response=form_content,
                    status="error",
                    error="无效输入或不完整问卷",
                )
        elif form_content:
            user_message = f"{form_content}\n**用户输入**: {user_message}" if user_message not in ["传递", "", " "] else form_content

        # 构造消息
        messages = [{"role": "system", "content": system_prompt}]
        for msg in request.history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": user_message})

        # 调用 Grok API（指数退避重试）
        logger.debug(f"发送到 Grok API 的消息: {json.dumps(messages, ensure_ascii=False, indent=2)}")
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = await client.chat.completions.create(
                    model="grok-3",
                    messages=messages,
                    max_tokens=500,
                    temperature=0.9 if request.expert_type == "insurance" else 0.7,
                    timeout=20,
                )
                ai_response = response.choices[0].message.content.strip()
                logger.debug(f"Grok API 响应: {ai_response[:100]}...")  # 截断日志
                return ChatResponse(response=ai_response)
            except Exception as e:
                if attempt < max_retries - 1:
                    delay = 2**attempt  # 指数退避：1s, 2s, 4s
                    logger.warning(f"API 调用失败，重试 {attempt + 1}/{max_retries}: {str(e)}")
                    await asyncio.sleep(delay)
                    continue
                logger.error(f"Grok API 调用失败: {str(e)}")
                # 静态补救响应
                if request.expert_type == "insurance" and is_form_complete:
                    return ChatResponse(
                        response=(
                            f"{form_content}\n"
                            "### 初步建议\n"
                            "根据您的问卷信息，建议优先考虑意外险和重疾险组合。\n"
                            "### 后续问题\n"
                            "1. 您的年度保险预算是多少？\n"
                            "2. 您是否有需要保障的家庭成员（如父母或子女）？"
                        )
                    )
                elif request.expert_type == "medical" and is_form_complete:
                    return ChatResponse(
                        response=(
                            f"{form_content}\n"
                            "### 推荐诊断\n"
                            "可能为上呼吸道感染\n"
                            "### 诊断理由\n"
                            "您的症状持续时间较短，无严重并发症。\n"
                            "### 建议\n"
                            "- 多休息，保持水分摄入。\n"
                            "- 监测体温，如持续高烧请就医。\n"
                            "### 后续问题\n"
                            "您的症状是否伴随喉咙痛或乏力？"
                        )
                    )
                else:
                    error_message = (
                        "### 错误提示\n"
                        "无法连接到 Grok API，可能是网络不稳定或 API 密钥无效。\n"
                        "### 建议\n"
                        "- 请检查网络连接或禁用代理。\n"
                        "- 验证 API 密钥：https://console.x.ai\n"
                        "- 稍后重试或联系支持团队。"
                    )
                    raise HTTPException(status_code=500, detail=error_message)
    except ValueError as ve:
        logger.error(f"请求验证错误: {str(ve)}")
        return ChatResponse(
            response=f"### 错误提示\n{str(ve)}",
            status="error",
            error=str(ve),
        )
    except Exception as e:
        logger.error(f"服务器错误: {str(e)}")
        error_message = (
            f"### 服务器错误\n{str(e)}\n"
            "### 建议\n"
            "- 检查网络连接或禁用代理。\n"
            "- 验证 API 密钥：https://console.x.ai\n"
            "- 稍后重试或联系支持团队。"
        )
        if "403" in str(e):
            error_message = (
                "### 错误提示\n"
                "API 密钥无效或被阻止。\n"
                "### 建议\n"
                "- 请从 https://console.x.ai 生成新密钥。\n"
                "- 确保密钥未泄露或被限制。"
            )
        elif "404" in str(e):
            error_message = (
                "### 错误提示\n"
                "模型未找到。\n"
                "### 建议\n"
                "- 确认使用模型 'grok-3'。\n"
                "- 联系 xAI 支持以获取帮助。"
            )
        raise HTTPException(status_code=500, detail=error_message)

@app.post("/api/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    try:
        # 验证文件大小（最大5MB）
        max_size = 5 * 1024 * 1024
        if file.size > max_size:
            logger.warning(f"文件 {file.filename} 过大: {file.size} 字节")
            return UploadResponse(
                response="",
                status="error",
                error="### 错误提示\n文件大小超过5MB限制。",
            )

        # 验证文件类型
        allowed_types = ["application/pdf", "image/jpeg", "image/png"]
        if file.content_type not in allowed_types:
            logger.warning(f"文件 {file.filename} 类型无效: {file.content_type}")
            return UploadResponse(
                response="",
                status="error",
                error="### 错误提示\n不支持的文件类型，仅允许PDF、JPEG和PNG。",
            )

        # 简单文件头检查
        content = await file.read()
        if file.content_type == "application/pdf" and not content.startswith(b"%PDF-"):
            logger.warning(f"文件 {file.filename} 不是有效的 PDF")
            return UploadResponse(
                response="",
                status="error",
                error="### 错误提示\n文件不是有效的 PDF 格式。",
            )
        elif file.content_type in ["image/jpeg", "image/png"]:
            if file.content_type == "image/jpeg" and not (content.startswith(b"\xFF\xD8") or content[:4] == b"\x4A\x46\x49\x46"):
                logger.warning(f"文件 {file.filename} 不是有效的 JPEG")
                return UploadResponse(
                    response="",
                    status="error",
                    error="### 错误提示\n文件不是有效的 JPEG 格式。",
                )
            elif file.content_type == "image/png" and not content.startswith(b"\x89\x50\x4E\x47"):
                logger.warning(f"文件 {file.filename} 不是有效的 PNG")
                return UploadResponse(
                    response="",
                    status="error",
                    error="### 错误提示\n文件不是有效的 PNG 格式。",
                )

        # Base64 编码
        base64_content = base64.b64encode(content).decode('utf-8')
        file_type = file.content_type

        # 使用 Grok API 分析文件
        prompt = (
            "请分析上传的文件内容：如果是PDF，提取关键文本；如果是图像，描述内容并提取任何文本。回复使用 Markdown 格式，例如：\n"
            "### 文件分析\n"
            "- **文件名**: {文件名}\n"
            "- **内容**: {提取的文本或描述}\n"
            "### 建议\n"
            "- {具体建议，如就医或保险方案调整}\n"
        )
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{file_type};base64,{base64_content}"}},
                ],
            }
        ]
        response = await client.chat.completions.create(
            model="grok-3",
            messages=messages,
            max_tokens=300,
            timeout=20,
        )
        analysis = response.choices[0].message.content.strip()

        response_text = (
            f"### 文件上传成功\n"
            f"- **文件名**: {file.filename}\n"
            f"### 分析结果\n"
            f"{analysis}\n"
            "### 小建议\n"
            "上传医疗报告后，建议定期与医生沟通以获取专业解读。"
        )
        logger.debug(
            f"文件上传并分析: {file.filename}, 大小: {len(content)} 字节, 分析: {analysis[:100]}..."
        )  # 截断日志
        return UploadResponse(response=response_text)
    except Exception as e:
        logger.error(f"文件上传失败: {str(e)}")
        return UploadResponse(
            response="",
            status="error",
            error=(
                f"### 文件上传错误\n{str(e)}\n"
                "### 建议\n"
                "- 检查文件格式（仅支持PDF、JPEG、PNG）。\n"
                "- 确保文件大小小于5MB。\n"
                "- 稍后重试或联系支持团队。"
            ),
        )

@app.get("/health")
async def health_check():
    logger.info("健康检查请求")
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    logger.info("启动 FastAPI 服务器")
    uvicorn.run(app, host="0.0.0.0", port=8000)