window.PROMPT_CONFIGS = window.PROMPT_CONFIGS || {};
window.PROMPT_CONFIGS["summary"] = {
  config: {
    title: "암기장 코드블럭",
    prefix: "",
    suffix: "작성된 암기장을 바로 코드블럭에 넣어서, 캔버스 쓰지말고, 제공해줘 : ",
    split: true,
    mode: "sentence",
    chunkSize: 1000,
    tags: "영어,문법,교육",
    category: "언어"
  },
  commands: [
    "문장을 분석해서 예문을 포함한 설명을 작성",
    "각 문장의 문법 포인트를 짚어줘"
  ]
};
