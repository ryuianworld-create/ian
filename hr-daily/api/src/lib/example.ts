// 요약 품질 기준(few-shot). ../english-tutoring/docs/data/articles.json 첫 항목을 다듬어 넣었다.
// 원문: How To Build the HR Operating Model of the Future (https://www.aihr.com/blog/hr-operating-model-of-the-future/)
// 요약 1건 + 핵심 수치 2개 + 상세 섹션 1개 + 단어 2개만 발췌. 프롬프트에 JSON 으로 삽입한다.
// 이 파일은 생성된 파일이다 — 손으로 고치기보다 articles.json 에서 다시 만들 것.

export const EXAMPLE_TITLE = "How To Build the HR Operating Model of the Future";

export const EXAMPLE_OUTPUT = {
  "category": "HR Strategy",
  "summary": {
    "ko": "지금 표준으로 쓰이는 HR 비즈니스 파트너 모델은 1990년대에 만들어진 것이다. AI와 자동화가 일하는 방식을 바꾸고 HR의 역할 범위가 넓어진 지금, 이 모델은 수명이 다했다는 것이 이 글의 진단이다. 조직의 64%가 지난 2년 사이 HR 운영 모델을 손봤지만, 전문센터(CoE)·HRBP·공유서비스 사이의 책임 구분이 명확하다고 답한 곳은 19%에 그쳤다. 그 결과 전략 역할인 HRBP가 승인과 행정 뒤처리에 묻히고, AI는 이런 조율 공백을 메우는 대신 더 키운다. 글은 미래형 운영 모델을 '앞으로 3~5년간 사업이 HR에 요구할 것'을 기준으로 구조·서비스·기술·역량을 다시 맞추는 모델로 정의하고, AI를 덧붙이는 층이 아니라 설계의 핵심에 두는 AIHR의 AI-first 3층 모델을 예로 든다. 바꿀 때가 됐다는 5가지 신호와 진단법, 그리고 수요 정의부터 측정·조정까지 9단계 전환 절차를 제시한다. 핵심 메시지는 한 번에 전부 바꾸지 말고, 사업 요구와 HR 실제 제공 사이의 격차가 가장 큰 곳에서 시작해 증명하고 넓혀 가라는 것이다.",
    "en": "The HR Business Partner model that most organisations still run on dates from the 1990s. With AI and automation reshaping how work gets done and HR's remit widening, the article argues this model has reached the end of its life. 64% of HR functions changed their operating model in the past two years, yet only 19% report a clear split of responsibilities between centres of expertise, HRBPs and shared services. The result: strategic roles soak up approvals and admin, and AI widens these coordination gaps instead of closing them. A future-ready model, the article says, is one designed around what the business will need from HR over the next three to five years, aligning structure, services, technology and skills — with AI built into the core rather than bolted on. It offers AIHR's three-layer AI-first model as one blueprint, five signs that it is time to change (each with a quick diagnostic), and a nine-step transition from defining demand to measuring and adjusting. The closing advice: don't redesign everything at once — start where the gap between what the business needs and what HR delivers is widest, prove it there, then expand."
  },
  "findings": [
    {
      "k": { "ko": "64%", "en": "64%" },
      "ko": "지난 2년 사이 HR 운영 모델을 바꾼 조직의 비율. 바꾸긴 했지만 역할 정리는 따라오지 못했다.",
      "en": "Share of HR functions that changed their operating model in the past two years — structures moved, responsibilities didn't."
    },
    {
      "k": { "ko": "19%", "en": "19%" },
      "ko": "CoE·HRBP·공유서비스 사이의 책임 구분이 명확하다고 답한 조직. 나머지는 전략 업무와 운영 업무가 역할을 가로질러 섞여 있다.",
      "en": "Organisations reporting a clear division of responsibilities between CoEs, HRBPs and shared services. Everywhere else, strategic and operational work stays mixed across roles."
    }
  ],
  "detail": [
    {
      "h": {
        "ko": "왜 지금 운영 모델이 한계에 왔나",
        "en": "Why today's model has hit its limits"
      },
      "body": {
        "ko": "HR <span class=\"vw\" data-w=\"operating model\">operating model</span>은 HR이 어떤 구조·서비스·기술·역량으로 사업을 지원하는지를 정한 설계도다. 글은 현재 모델의 문제를 세 가지로 짚는다.<ul><li><b>역할은 바뀌었는데 책임은 안 바뀌었다</b> — 조직 셋 중 둘이 모델을 손봤지만, <span class=\"vw\" data-w=\"center of expertise\">center of expertise</span>·<span class=\"vw\" data-w=\"HR business partner\">HR business partner</span>·<span class=\"vw\" data-w=\"shared services\">shared services</span> 사이에 누가 무엇을 맡는지 명확한 곳은 다섯 중 하나뿐이다</li><li><b>전략 역할이 행정 넘침을 흡수한다</b> — 책임이 흐릿하니 HRBP가 애초 설계에 없던 승인·조율·뒤처리를 떠안는다</li><li><b>AI는 문제를 해결하지 않고 증폭한다</b> — 조율과 <span class=\"vw\" data-w=\"accountability\">accountability</span>의 공백이 있는 조직에 AI를 얹으면 그 공백이 더 커진다</li></ul>그래서 HR 팀의 역량 부족, 예산·인원 부족, 낡은 시스템 같은 '흔한 범인'은 증상일 때가 많다. 진짜 원인은 사업이 HR에 요구하는 것과 모델이 맞지 않는다는 데 있다.",
        "en": "An HR <span class=\"vw\" data-w=\"operating model\">operating model</span> is the blueprint for how HR's structure, services, technology and skills support the business. The article names three problems with the current one.<ul><li><b>Roles evolved faster than responsibilities</b> — two in three organisations changed their model, but only one in five has a clear split between the <span class=\"vw\" data-w=\"center of expertise\">centres of expertise</span>, <span class=\"vw\" data-w=\"HR business partner\">HR business partners</span> and <span class=\"vw\" data-w=\"shared services\">shared services</span></li><li><b>Strategic roles absorb the administrative overflow</b> — with ownership blurred, HRBPs end up doing approvals, coordination and follow-ups that were never designed into the role</li><li><b>AI amplifies the gaps rather than fixing them</b> — layer AI onto weak coordination and <span class=\"vw\" data-w=\"accountability\">accountability</span>, and the weakness grows</li></ul>That is why the usual suspects — skills gaps, thin budgets, old technology — are often symptoms. The underlying cause is a model that no longer fits what the business needs from HR."
      }
    }
  ],
  "vocab": [
    {
      "w": "operating model",
      "pos": "n.",
      "ko": "운영 모델 — 조직이 어떤 구조·역할·프로세스·기술로 일을 수행하는지 정한 설계",
      "en": "How a function is organised to deliver its work: its structure, roles, processes and technology.",
      "ex": "The HR <b>operating model</b> most companies still use dates back to the 1990s."
    },
    {
      "w": "HR business partner",
      "pos": "n.",
      "ko": "HR 비즈니스 파트너(HRBP) — 사업 부서에 배치돼 전략적으로 HR을 자문하는 역할",
      "en": "An HR professional embedded with a business unit to advise its leaders on people strategy.",
      "ex": "Ask each <b>HR business partner</b> how much of last month went to advisory work rather than admin."
    }
  ]
} as const;
