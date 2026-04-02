import json
import ollama

# 使用するモデル（先ほど残した優秀な9Bモデルを指定してください）
MODEL_NAME = "kwangsuklee/qwen3.5-9b.q4_k_m-claude-4.6-opus-reasoning-distilled-v2:latest"

# 裏側でEconが埋めるべき最終ゴール（ステート）
company_state = {
    "business_core": None,  # 誰に何を売るか
    "company_type": None,   # 株式会社 or 合同会社
    "capital_jpy": None,    # 資本金
    "status": "0%_complete"
}

# Econの基本人格（システムプロンプト）
ECON_SYSTEM_PROMPT = """
あなたは起業家をスクリーニングし、最速で会社設立に導くAIバディ「Econ（エコン）」です。
優秀な起業家には最高のパスを出し、フワッとした人には具体的な決断を迫ります。
口調は「よっす、Econだよ。」のような、ノリが良く自信に満ちたフランクなバディとして振る舞ってください。

現在のユーザーの会社情報（JSON）:
{state}

あなたのタスクは、上記のJSONで「null」になっている項目を順番にユーザーに質問し、決定させることです。
一度に聞くのは1つの項目だけにして、会話をリードしてください。
"""

def chat_with_econ(user_input, current_state):
    # JSONの状態をプロンプトに埋め込んで、Econに「次何を話すべきか」を考えさせる
    prompt = ECON_SYSTEM_PROMPT.replace("{state}", json.dumps(current_state, ensure_ascii=False))
    
    response = ollama.chat(model=MODEL_NAME, messages=[
        {"role": "system", "content": prompt},
        {"role": "user", "content": user_input}
    ])
    return response['message']['content']

# ====== メインループ（プロトタイプ） ======
print("============================================================")
print("🌍 Econ プロトタイプ起動")
print("============================================================\n")

# 最初の一撃（Econからのアプローチ）
econ_reply = "よっす、Econだよ。会社、作るんだね。最高じゃん。で、単刀直入に聞くけど、『誰に、何を売って、最初の1円を稼ぐか』、もう決まってる？"
print(f"🤖 Econ: {econ_reply}\n")

while True:
    try:
        user_msg = input("👤 あなた: ")
    except EOFError:
        break
    if user_msg.lower() in ["exit", "quit"]:
        break
        
    # 1. ここに「裏の顔（LLMにuser_msgを読ませて、company_stateのJSONを更新させる処理）」を挟む（今回はモックとして省略）
    # ※ 本番ではここで Function Calling や Structured Output を使ってJSONを書き換えます。
    
    # 2. 最新のJSONステートを元に、Econに次のセリフを喋らせる
    econ_reply = chat_with_econ(user_msg, company_state)
    print(f"\n🤖 Econ: {econ_reply}\n")
    
    # JSONの中身をデバッグ用に表示
    print(f"--- [裏側のData State]: {company_state} ---")
