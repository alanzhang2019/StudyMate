import type { MistakeCode, MistakeLabel } from "../domain/types.js";

export const mistakeTaxonomy: Record<MistakeCode, MistakeLabel> = {
  carry_mistake: {
    code: "carry_mistake",
    name: "进位错误",
    description: "加法计算时忘记把满十进到前一位。",
    triggers: ["进位", "满十", "忘记加1", "carry", "36+27=53"],
  },
  borrow_mistake: {
    code: "borrow_mistake",
    name: "退位错误",
    description: "减法计算时没有正确向前一位借1。",
    triggers: ["退位", "借位", "借1", "borrow"],
  },
  operator_confusion: {
    code: "operator_confusion",
    name: "运算符混淆",
    description: "把加减乘除的运算关系看错或用错。",
    triggers: ["加减混淆", "乘除混淆", "+", "-", "*", "/"],
  },
  bracket_order_error: {
    code: "bracket_order_error",
    name: "顺序错误",
    description: "没有先算括号或没有按正确运算顺序计算。",
    triggers: ["括号", "先算", "顺序", "运算顺序"],
  },
  unit_conversion_error: {
    code: "unit_conversion_error",
    name: "单位换算错误",
    description: "长度、重量、时间等单位换算时出现错误。",
    triggers: ["单位", "厘米", "米", "千克", "小时", "分钟"],
  },
  concept_gap: {
    code: "concept_gap",
    name: "概念理解不足",
    description: "对题目所涉及的核心知识点理解不牢固。",
    triggers: ["不会", "不懂", "概念", "应用题", "平均分"],
  },
};

export function getMistakeLabel(code: MistakeCode): MistakeLabel {
  return mistakeTaxonomy[code];
}
