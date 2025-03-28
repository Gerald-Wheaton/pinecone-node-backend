export function buildCandidateProfile(record) {
  const age = record.Age
  const gender = record.Gender
  const country = record.Country
  const edLevel = record.EdLevel
  const employed = record.Employment === "1" ? "employed" : "unemployed"
  const mainBranch = record.MainBranch === "Dev" ? "Developer" : "Non-developer"
  const yearsCode = record.YearsCode
  const yearsPro = record.YearsCodePro
  const skills = record.HaveWorkedWith?.split(";").join(", ")
  const tools = record.ComputerSkills?.split(";").join(", ")
  const salary = record.PreviousSalary

  return `A ${age}-year-old ${gender} from ${country} with a ${edLevel} degree, currently ${employed} as a ${mainBranch} with ${yearsCode} years of coding experience (${yearsPro} professional). Familiar with ${skills}. Other tools: ${tools}. Previous salary: $${salary}.`
}
