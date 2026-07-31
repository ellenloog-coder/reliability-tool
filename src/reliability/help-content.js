const manual = {
  en: {
    title: "User Manual",
    subtitle: "Operate the functions available in this browser release and interpret their engineering boundaries.",
    contentsLabel: "Contents",
    chapters: [
      {
        id: "quick-start",
        title: "Quick Start",
        sections: [{
          text: "Choose an analysis module from the top navigation. Life Data and MTBF accept imported or pasted data; Reliability Demonstration uses parameter forms. ALT is visible for scope reference but is not calculable in this release.",
          steps: [
            "Choose Life Data, MTBF, or Reliability Demonstration.",
            "Enter data or parameters. For file workflows, confirm the detected column mapping and validation messages.",
            "Set the mission time, target, confidence, or other parameters required by the selected workflow.",
            "Run the analysis. The settings panel collapses after a successful result and can be reopened without losing state.",
            "Use the result tabs to inspect the summary, calculations, charts, limitations, and data summary.",
            "For supported modules, export the current result as HTML, PDF/print output, or print directly."
          ]
        }]
      },
      {
        id: "data-preparation",
        title: "Data Preparation",
        sections: [
          {
            heading: "Supported input",
            bullets: [
              "Life Data and MTBF unit-level workflows accept CSV, TSV, XLSX, compatible text/HTML-style XLS, or pasted delimited text.",
              "Legacy binary XLS workbooks are not parsed; save them as XLSX, CSV, or TSV.",
              "Life Data requires Time and Status. Sample ID, Failure Mode, and Test Condition are optional.",
              "MTBF unit-level data requires Exposure Time and Status. Unit ID, Failure Mode, Test Condition, and Notes are optional.",
              "MTBF summary input uses Total Time on Test and Failure Count, plus a positive Mission Time; Target MTBF is optional."
            ],
            sample: "Sample ID,Time,Status,Failure Mode,Test Condition\nS001,320,Failure,Seal crack,85C life test\nS002,1000,Censored,,85C life test"
          },
          {
            heading: "Status and units",
            bullets: [
              "Recognized failures include Failure, Fail, Event, Breakdown, 1, Yes, 失效, 故障, and 失败.",
              "Recognized right-censored states include Censored, Suspended, Survived, Operating, No Failure, 0, No, 截尾, 删失, 未失效, and 正常运行.",
              "Use one time unit consistently within an analysis. Life Data offers hours, cycles, or days; MTBF and time-based demonstration also offer minutes or a generic unit.",
              "Blank rows are ignored. Non-positive or non-numeric time values and unrecognized status values are excluded and reported by validation.",
              "Duplicate Life Data sample IDs are not used as a statistical grouping key. MTBF duplicate Unit IDs produce a warning."
            ]
          },
          {
            heading: "Templates and examples",
            text: "Use the template buttons to download the exact headers expected by Life Data or MTBF. Load Example fills the current module with a small validated dataset; you can then run the analysis and inspect every available result tab."
          }
        ]
      },
      {
        id: "life-data",
        title: "Life Data",
        sections: [
          { heading: "Purpose and suitable use", text: "Fits a two-parameter Weibull model by maximum likelihood to positive failure times with optional right-censored observations. Use it for non-repairable life data when a Weibull 2P model is an appropriate engineering assumption." },
          { heading: "Required data and steps", bullets: ["Provide Time and Status columns, map them, select one time unit, and enter a positive mission time.", "A target reliability between 0 and 1 is optional; it enables a point-estimate target comparison.", "At least one observed failure is required. Fewer than five failures produces an instability warning."] },
          { heading: "Results and charts", bullets: ["Overview: Weibull 2P method, β, η, B1/B5/B10/B50, mission reliability R(t), failure probability F(t), sample and failure counts.", "Weibull Probability Plot: fitted line, failure observations, and right-censored markers.", "Reliability Curve panel: independent R(t) and F(t) charts using the same time range; F(t) = 1 − R(t).", "B-value and R(t)/F(t) tables support one custom percentile and one custom time.", "Statistical Information reports the implemented model and limitations; model-fit goodness-of-fit statistics and confidence bounds are not implemented."] },
          { heading: "Interpretation", bullets: ["β < 1 suggests a decreasing failure-rate pattern; β near 1 is consistent with an approximately constant rate; β > 1 suggests an increasing or wear-out pattern. These are model-based indications, not root-cause proof.", "η is the time at which fitted cumulative failures reach about 63.2%; it is not the arithmetic mean life.", "B10 is the fitted time by which 10% of the population has failed.", "R(t) is the fitted survival probability at time t and F(t) is its complement."] },
          { heading: "Limits and common errors", bullets: ["Only Weibull 2P is supported; Weibull 3P and distribution selection are not available.", "Zero-failure data cannot estimate Weibull parameters; use Reliability Demonstration for evidence against a defined target.", "Sparse failures, non-representative sampling, mixed failure mechanisms, or changed test conditions can make the fitted parameters misleading.", "An invalid or missing Time/Status mapping keeps Run Analysis disabled."] }
        ]
      },
      {
        id: "mtbf",
        title: "MTBF",
        sections: [
          { heading: "Purpose and suitable use", text: "Estimates failure rate, MTBF, mission reliability, and mission failure probability from accumulated exposure under an exponential constant-failure-rate assumption." },
          { heading: "Required data and steps", bullets: ["Summary mode: enter positive Total Time on Test, a non-negative integer Failure Count, a positive Mission Time, and optionally Target MTBF.", "Unit-Level mode: import or paste one exposure record per unit with Exposure Time and final Failure/Censored status, then confirm mapping.", "Choose a single time unit and run the analysis."] },
          { heading: "Results and charts", bullets: ["MTBF Results reports the point estimate, failure rate, mission R(t), mission F(t), total exposure, and failure/censored counts.", "Distribution Fit shows the exponential reliability curve when a finite estimate exists.", "The target decision compares the MTBF point estimate only; no statistical confidence bound is included.", "MTTR and Availability tabs explicitly remain unavailable because repair-duration evidence is not calculated.", "Supported results can be exported as HTML, PDF/print output, or printed."] },
          { heading: "Limits and common errors", bullets: ["MTBF is not the expected lifetime of each product and is not directly interchangeable with Weibull life percentiles.", "Unit-Level mode does not model repeated failures or reliability growth in one repairable system.", "Zero failures do not produce Infinity; the point estimate and curve are marked not estimable.", "Mixed units, non-positive exposure, invalid status, or missing mapping blocks analysis."] }
        ]
      },
      {
        id: "demonstration",
        title: "Reliability Demonstration",
        sections: [
          { heading: "Purpose and suitable use", text: "Plans or evaluates statistical evidence at a target and confidence level using exact sample-based binomial or time-based exponential methods." },
          { heading: "Workflows and inputs", bullets: ["Sample Plan: target reliability, confidence level, allowable failures; mission time is optional context.", "Sample Evaluate: the same target inputs plus Units Tested and Observed Failures.", "Time Plan: confidence, allowable failures, and either a target MTBF or a target reliability with mission time; Number of Units is optional for an estimated time per unit.", "Time Evaluate: the same target definition plus Total Test Time and Observed Failures."] },
          { heading: "Results and chart", bullets: ["Verification Plan, Verification Results, Confidence Interval/Evidence, Verification Conclusion, Statistical Information, and Data Summary are separate result tabs.", "Outputs may include required sample size or total exposure, achieved confidence, reliability or MTBF lower bound, demonstrated status, and evidence gap.", "The chart compares actual or planned evidence with required confidence.", "Reports can be exported as HTML, PDF/print output, or printed."] },
          { heading: "Assumptions and limits", bullets: ["Sample-based analysis treats units as independent final pass/failure outcomes at the same mission definition; it does not model failure time.", "Time-based analysis assumes an exponential constant failure rate and independent failure events.", "A calculated plan is not proof that a completed product test passed; evaluation requires the actual observed evidence.", "Weibull demonstration, reliability growth, Crow-AMSAA, sequential testing, Bayesian methods, dual-risk OC design, multi-stress analysis, and competing risks are not supported."] }
        ]
      },
      {
        id: "alt",
        title: "Accelerated Life Testing",
        sections: [
          { heading: "Current availability", text: "ALT is not implemented in the current release. The module has no data import, parameter entry, analysis engine, calculated chart, or report export." },
          { heading: "What the visible screen means", text: "Names shown in the ALT area are scope markers only. They are not selectable or validated models and must not be used as evidence that an acceleration model is supported." },
          { heading: "What users should do", text: "Do not enter assumptions or extrapolate use-condition life through this tool. Perform ALT model selection, mechanism verification, fitting, diagnostics, and use-condition prediction with an appropriately validated method outside this release." }
        ]
      },
      {
        id: "results",
        title: "Interpreting Results",
        sections: [
          { heading: "Navigation", text: "Only the selected result tab is displayed. Overview summarizes the current run; model/result tabs expose parameters; chart tabs visualize the fitted relationship; Statistical Information and Data Summary record assumptions, validation, and source data." },
          { heading: "Engineering decisions", bullets: ["Target comparisons use the requirement entered for the current analysis and the metric stated by the panel.", "A point estimate meeting a target does not establish confidence unless the workflow explicitly calculates confidence evidence.", "Warnings and limitations are part of the result and should be retained when results are reviewed or exported.", "Rounded chart or table labels may differ slightly in displayed decimals while deriving from the same underlying value."] }
        ]
      },
      {
        id: "reports",
        title: "Report Export",
        sections: [{
          text: "After a supported analysis completes, use Report Export in the Data Summary tab. Export HTML downloads a standalone report. Export PDF opens the browser print workflow for saving as PDF; Print uses the same print-ready report.",
          bullets: [
            "Confirm the selected module, source data, unit, mission/target settings, validation warnings, and current result before exporting.",
            "Reports are generated from the completed analysis result and current interface language. Changing inputs requires rerunning analysis before the report represents those changes.",
            "The report is an engineering analysis artifact, not an automatically approved validation record or regulatory release."
          ]
        }]
      },
      {
        id: "application-scenarios",
        title: "Application Scenarios",
        sections: [
          {
            heading: "Life Data",
            bullets: [
              "Product life-test analysis: combine observed failures and right-censored units from a non-repairable product test to estimate Weibull β, η, B10, and reliability at a defined mission time.",
              "Field or warranty life review: analyze consistent time-to-failure and still-operating records to screen for early-failure, approximately random, or wear-out patterns before a separate physical failure-mode investigation."
            ]
          },
          {
            heading: "MTBF",
            bullets: [
              "Accumulated operating-exposure summary: use total bench, fleet, or system operating time and observed failures to estimate constant failure rate, MTBF, and mission reliability under the exponential assumption.",
              "Internal target screening: compare the observed MTBF point estimate with an engineering target and review the expected mission reliability; this is a point-estimate screen, not a confidence-based qualification."
            ]
          },
          {
            heading: "Reliability Demonstration",
            bullets: [
              "Sample-based verification planning or evaluation: determine the sample size and allowable failures, or evaluate completed pass/fail evidence, for a target reliability and confidence level.",
              "Time-based verification planning or evaluation: determine required accumulated exposure, or evaluate completed exposure and observed failures, against a target MTBF or mission reliability under the exponential assumption."
            ]
          },
          {
            heading: "Accelerated Life Testing",
            bullets: [
              "Accelerated test-program design: engineering teams may need to compare life behavior across temperature, voltage, load, or other stress levels while confirming that the failure mechanism remains unchanged.",
              "Use-condition extrapolation: validated multi-stress life data may be used outside this release to fit an appropriate acceleration model and predict use-condition life."
            ],
            text: "ALT is not implemented in the current release. These are selection references only; this tool cannot currently fit an acceleration model, calculate an acceleration factor, or make use-condition predictions."
          }
        ]
      },
      {
        id: "privacy",
        title: "Data and Privacy",
        sections: [{
          text: "Files are parsed in the browser. Life Data analysis inputs are sent to the configured Reliability Backend, which returns one calculation, Decision, chart-data, and report-data snapshot. MTBF and Demonstration retain their current browser workflows. The application uses no account, application database, third-party AI, or external analysis service.",
          bullets: [
            "The Reliability Backend is used only for Life Data reliability calculation and does not retain input data in the current implementation.",
            "The selected language preference is stored in browser localStorage.",
            "Downloaded reports and templates are saved through the browser and are then governed by the user's device and browser settings.",
            "The hosting environment can still receive ordinary page requests. Review the deployment and browser environment before handling controlled or confidential data."
          ]
        }]
      },
      {
        id: "limitations",
        title: "Use Limitations",
        sections: [{
          bullets: [
            "This is an engineering analysis and decision-support tool.",
            "Results depend on data quality, sampling representativeness, consistent units, model assumptions, and correct settings.",
            "A statistical fit does not by itself demonstrate a physical failure mechanism, product verification, compliance, or release readiness.",
            "Combine results with test design, failure-mode analysis, engineering judgment, applicable standards, and controlled review.",
            "Preserve source data, settings, warnings, and the tool version when results are used in a formal process."
          ]
        }]
      }
    ]
  },
  zh: {
    title: "用户手册",
    subtitle: "说明当前浏览器版本已经具备的操作能力及其工程使用边界。",
    contentsLabel: "目录",
    chapters: [
      {
        id: "quick-start",
        title: "快速开始",
        sections: [{
          text: "从顶部导航选择分析模块。寿命数据和 MTBF 支持导入或粘贴数据；可靠性验证使用参数表单。ALT 目前仅展示范围说明，本版本不能执行计算。",
          steps: ["选择寿命数据、MTBF 或可靠性验证。", "输入数据或参数；文件型流程需确认自动识别的列映射和校验消息。", "设置任务时间、目标、置信水平或当前流程要求的其他参数。", "运行分析。成功后设置栏会收起，重新展开不会丢失状态。", "通过结果导航查看摘要、计算、图表、局限性和数据摘要。", "对于支持的模块，可导出 HTML、通过 PDF/打印流程保存，或直接打印。"]
        }]
      },
      {
        id: "data-preparation",
        title: "数据准备",
        sections: [
          { heading: "支持的输入", bullets: ["寿命数据和 MTBF 单元级流程支持 CSV、TSV、XLSX、兼容的文本/HTML 型 XLS，以及粘贴的分隔文本。", "不能解析旧式二进制 XLS；请另存为 XLSX、CSV 或 TSV。", "寿命数据必填 Time 和 Status；Sample ID、Failure Mode、Test Condition 可选。", "MTBF 单元级数据必填 Exposure Time 和 Status；Unit ID、Failure Mode、Test Condition、Notes 可选。", "MTBF 汇总输入需要 Total Time on Test、Failure Count 和正数 Mission Time；Target MTBF 可选。"], sample: "Sample ID,Time,Status,Failure Mode,Test Condition\nS001,320,Failure,Seal crack,85C life test\nS002,1000,Censored,,85C life test" },
          { heading: "状态和单位", bullets: ["可识别的失效状态包括 Failure、Fail、Event、Breakdown、1、Yes、失效、故障、失败。", "可识别的右删失状态包括 Censored、Suspended、Survived、Operating、No Failure、0、No、截尾、删失、未失效、正常运行。", "一次分析内应统一时间单位。寿命数据支持小时、循环、天；MTBF 和时间型验证还支持分钟或通用单位。", "空行会被忽略；非正数、非数字时间和无法识别的状态会被排除并在校验中报告。", "寿命数据的重复样品编号不作为统计分组键；MTBF 重复 Unit ID 会产生警告。"] },
          { heading: "模板和示例", text: "模板按钮可下载寿命数据或 MTBF 当前实际需要的表头。加载示例会将经过校验的小型数据集填入当前模块，可直接运行并查看所有可用结果页签。" }
        ]
      },
      {
        id: "life-data",
        title: "寿命数据",
        sections: [
          { heading: "用途与适用场景", text: "使用最大似然法对正数失效时间和可选右删失记录拟合二参数 Weibull 模型。适用于 Weibull 2P 假设合理的不可维修产品寿命数据。" },
          { heading: "所需数据与步骤", bullets: ["提供并映射 Time、Status，选择统一时间单位并输入正数任务时间。", "目标可靠度为 0 到 1 之间的可选值；提供后执行点估计目标比较。", "至少需要一个观察失效；少于五个失效会提示参数可能不稳定。"] },
          { heading: "结果与图表", bullets: ["概要显示 Weibull 2P 方法、β、η、B1/B5/B10/B50、任务 R(t)、F(t)、样本数和失效数。", "Weibull 概率图显示拟合线、失效观测点和右删失标记。", "可靠性曲线面板独立显示共用时间范围的 R(t) 与 F(t)，且 F(t)=1−R(t)。", "B 值表和 R(t)/F(t) 表分别支持一个自定义百分位和一个自定义时间。", "统计信息说明已实现模型及局限；本版本不提供拟合优度统计量或参数置信界限。"] },
          { heading: "结果解读", bullets: ["β<1 表示拟合失效率呈下降趋势；β 接近 1 表示近似恒定；β>1 表示上升或磨损趋势。这是模型迹象，不是根因证明。", "η 是拟合累计失效达到约 63.2% 的时间，不等于算术平均寿命。", "B10 是拟合总体累计失效 10% 时的时间。", "R(t) 是 t 时刻的拟合存活概率，F(t) 是其补数。"] },
          { heading: "限制与常见错误", bullets: ["当前仅支持 Weibull 2P，不支持 Weibull 3P 或自动分布选择。", "零失效数据无法估计 Weibull 参数，应使用可靠性验证评估针对明确目标的证据。", "失效过少、抽样不具代表性、混合失效机理或试验条件变化都可能使拟合结果产生误导。", "Time/Status 未正确映射或数据无效时，运行按钮保持不可用。"] }
        ]
      },
      {
        id: "mtbf",
        title: "MTBF",
        sections: [
          { heading: "用途与适用场景", text: "在指数分布/恒定失效率假设下，根据累计暴露时间估计失效率、MTBF、任务可靠度和任务失效概率。" },
          { heading: "所需数据与步骤", bullets: ["汇总模式：输入正数总测试时间、非负整数失效数、正数任务时间；目标 MTBF 可选。", "单元级模式：每行导入或粘贴一个单元的暴露时间及最终 Failure/Censored 状态，并确认列映射。", "选择统一时间单位后运行分析。"] },
          { heading: "结果与图表", bullets: ["MTBF 结果显示点估计、失效率、任务 R(t)、任务 F(t)、总暴露时间以及失效/删失数。", "分布拟合页在存在有限估计时显示指数可靠性曲线。", "目标判断仅比较 MTBF 点估计，不包含统计置信下限。", "MTTR 和可用性页明确标记不可用，因为当前引擎不计算维修时长证据。", "支持的结果可以导出 HTML、通过 PDF/打印流程保存或直接打印。"] },
          { heading: "限制与常见错误", bullets: ["MTBF 不是每个产品的预期寿命，不能直接与 Weibull 寿命百分位互换。", "单元级模式不建模同一可维修系统的重复失效或可靠性增长。", "零失效不会输出 Infinity；点估计和曲线标记为不可估计。", "混合单位、非正数暴露时间、非法状态或缺少映射会阻止分析。"] }
        ]
      },
      {
        id: "demonstration",
        title: "可靠性验证",
        sections: [
          { heading: "用途与适用场景", text: "使用精确的样本型二项方法或时间型指数方法，在目标和置信水平下规划或评估统计证据。" },
          { heading: "流程与输入", bullets: ["样本规划：目标可靠度、置信水平、允许失效数；任务时间仅作为可选背景。", "样本评估：上述目标输入，加已测试样品数和观察失效数。", "时间规划：置信水平、允许失效数，以及目标 MTBF，或目标可靠度加任务时间；样品数可用于估算单件时间。", "时间评估：相同目标定义，加总测试时间和观察失效数。"] },
          { heading: "结果与图表", bullets: ["验证计划、验证结果、置信区间/证据、验证结论、统计信息和数据摘要分别显示。", "结果可能包括所需样本量或总暴露、达到的置信度、可靠度或 MTBF 下限、是否验证以及证据缺口。", "图表比较实际或规划证据与要求置信水平。", "可导出 HTML、通过 PDF/打印流程保存或直接打印。"] },
          { heading: "假设与限制", bullets: ["样本型分析把样品视为相同任务定义下相互独立的最终通过/失效结果，不建模失效时间。", "时间型分析假设指数分布恒定失效率和独立失效事件。", "计算出的试验方案不等于已完成产品通过验证；评估必须使用真实观察证据。", "不支持 Weibull 验证、可靠性增长、Crow-AMSAA、序贯试验、贝叶斯方法、双风险 OC、多应力或竞争风险。"] }
        ]
      },
      {
        id: "alt",
        title: "加速寿命试验",
        sections: [
          { heading: "当前可用性", text: "当前版本尚未实现 ALT。该模块没有数据导入、参数输入、分析引擎、计算图表或报告导出。" },
          { heading: "可见界面的含义", text: "ALT 区域出现的模型名称仅是范围标记，不是可选择、已验证或已实现的模型，不能据此认定工具支持某种加速模型。" },
          { heading: "用户应如何处理", text: "不要通过本工具填写假设或外推使用条件寿命。ALT 的模型选择、失效机理确认、拟合、诊断和使用条件预测需在本版本之外采用经过验证的方法完成。" }
        ]
      },
      {
        id: "results",
        title: "结果解读",
        sections: [
          { heading: "结果导航", text: "任何时刻只显示所选结果页签。概要汇总当前运行；模型/结果页展示参数；图表展示拟合关系；统计信息和数据摘要记录假设、校验与源数据。" },
          { heading: "工程判断", bullets: ["目标比较使用当前分析输入的要求和面板明确标注的指标。", "点估计达到目标不代表具有统计置信证据，除非当前流程明确计算了置信证据。", "警告和局限性属于结果的一部分，评审或导出时应保留。", "图表或表格因显示位数不同可能有轻微舍入差异，但来自同一底层数值。"] }
        ]
      },
      {
        id: "reports",
        title: "报告导出",
        sections: [{
          text: "支持的分析完成后，在数据摘要页签使用报告导出。导出 HTML 会下载独立报告；导出 PDF 会打开浏览器打印流程以保存 PDF；打印使用同一打印版报告。",
          bullets: ["导出前确认模块、源数据、单位、任务/目标设置、校验警告和当前结果。", "报告根据已完成的分析结果和当前界面语言生成。修改输入后必须重新运行，报告才会反映变化。", "导出报告是工程分析材料，不会自动成为获批验证记录或法规放行结论。"]
        }]
      },
      {
        id: "application-scenarios",
        title: "使用场景",
        sections: [
          {
            heading: "寿命数据",
            bullets: [
              "产品寿命试验分析：将不可维修产品试验中的观察失效与右删失样品合并分析，用于估计 Weibull β、η、B10 以及指定任务时间的可靠度。",
              "现场或质保寿命复盘：对条件一致的失效时间和仍在运行记录进行分析，初步识别早期失效、近似随机失效或磨损趋势，并进一步开展独立的物理失效模式调查。"
            ]
          },
          {
            heading: "MTBF",
            bullets: [
              "累计运行暴露汇总：使用台架、车队或系统的总运行时间和观察失效数，在指数分布假设下估计恒定失效率、MTBF 和任务可靠度。",
              "内部目标筛查：将观察 MTBF 点估计与工程目标比较，并查看预期任务可靠度；该场景属于点估计筛查，不等同于具有置信度的资格验证。"
            ]
          },
          {
            heading: "可靠性验证",
            bullets: [
              "样本型验证规划或评估：针对目标可靠度和置信水平确定样本量与允许失效数，或评估已完成试验的通过/失效证据。",
              "时间型验证规划或评估：在指数分布假设下，针对目标 MTBF 或任务可靠度确定所需累计暴露时间，或评估已完成的暴露时间和观察失效数。"
            ]
          },
          {
            heading: "加速寿命试验",
            bullets: [
              "加速试验方案设计：工程团队可能需要比较温度、电压、载荷或其他应力水平下的寿命表现，同时确认失效机理没有发生变化。",
              "使用条件寿命外推：经过验证的多应力寿命数据可在本版本之外选择合适的加速模型，并预测使用条件下的寿命。"
            ],
            text: "当前版本尚未实现 ALT。以上仅用于工具选择参考；本工具目前不能拟合加速模型、计算加速因子或执行使用条件寿命预测。"
          }
        ]
      },
      {
        id: "privacy",
        title: "数据与隐私",
        sections: [{
          text: "文件在浏览器内解析。寿命数据分析输入会发送至已配置的 Reliability Backend，并由其返回同一次计算、Decision、图表数据和报告数据快照；MTBF 与可靠性验证继续保留当前浏览器流程。应用不使用账户、应用数据库、第三方 AI 或外部分析服务。",
          bullets: ["当前实现中的 Reliability Backend 仅用于寿命数据可靠性计算，不保留输入数据。", "所选语言偏好保存在浏览器 localStorage。", "下载的报告和模板由浏览器保存，之后受用户设备和浏览器设置管理。", "托管环境仍会接收普通页面资源请求；处理受控或机密数据前应评估实际部署和浏览器环境。"]
        }]
      },
      {
        id: "limitations",
        title: "使用限制",
        sections: [{
          bullets: ["本工具属于工程分析和决策支持工具。", "结果依赖数据质量、抽样代表性、单位一致性、模型假设和正确设置。", "统计拟合本身不能证明物理失效机理、产品验证、合规性或放行就绪。", "应结合试验设计、失效模式分析、工程判断、适用标准和受控评审使用。", "用于正式流程时应保留源数据、设置、警告和工具版本。"]
        }]
      }
    ]
  }
};

const faqSeed = [
  ["getting-started", "Getting Started", "开始使用", [
    ["Which analysis module should I choose?", "我应该选择哪个实验模块？", "Use Life Data for failure-time and right-censored non-repairable data under Weibull 2P; MTBF for accumulated exposure under a constant failure rate; Reliability Demonstration to plan or evaluate target/confidence evidence. ALT cannot calculate results in this release.", "寿命数据用于 Weibull 2P 假设下的失效时间和右删失数据；MTBF 用于恒定失效率假设下的累计暴露；可靠性验证用于规划或评估目标/置信证据。当前 ALT 不能计算结果。"],
    ["Can I start with example data?", "可以先使用示例数据吗？", "Yes. Life Data and MTBF provide Load Example. Reliability Demonstration opens with valid default planning parameters. ALT has no example because its engine is unavailable.", "可以。寿命数据和 MTBF 提供“加载示例”；可靠性验证打开时带有有效的默认规划参数。ALT 引擎不可用，因此没有示例分析。"],
    ["How do I download a data template?", "如何下载数据模板？", "Use Download Excel Template or Download CSV Template in the Life Data or MTBF settings panel. Reliability Demonstration uses a form and has no file template.", "在寿命数据或 MTBF 设置栏中使用“下载 Excel 模板”或“下载 CSV 模板”。可靠性验证使用表单，不提供文件模板。"],
    ["Why is the analysis button disabled?", "为什么“分析”按钮不可用？", "Required fields may be missing or invalid. Check column mapping and validation for Life Data/MTBF, or the highlighted parameter messages for Demonstration. ALT Run is intentionally disabled.", "可能缺少必填字段或数据无效。寿命数据/MTBF 请检查列映射和校验；可靠性验证请检查参数提示。ALT 的运行按钮按设计保持禁用。"]
  ]],
  ["data-input", "Data Input", "数据输入", [
    ["Which file formats are supported?", "支持哪些文件格式？", "CSV, TSV, XLSX, compatible text/HTML-style XLS, and pasted delimited text are supported for file workflows. Legacy binary XLS must be resaved.", "文件型流程支持 CSV、TSV、XLSX、兼容的文本/HTML 型 XLS 和粘贴分隔文本。旧式二进制 XLS 需另存。"],
    ["What is the difference between failure and right-censored data?", "失效数据和右删失数据有什么区别？", "A failure records an observed event time. A right-censored record says the unit operated to the recorded time without an observed failure; its exact later failure time is unknown.", "失效记录表示已观察到事件时间；右删失表示样品运行到记录时间仍未观察到失效，其之后的确切失效时间未知。"],
    ["How should I select a time unit?", "时间单位应该如何选择？", "Choose the unit used by every time or exposure value in that analysis. The unit changes labels, not the numerical values.", "选择本次分析所有时间或暴露值共同使用的单位。单位只改变标签，不会自动换算数值。"],
    ["Why did data import fail?", "为什么数据导入失败？", "Common causes are an unsupported legacy binary XLS file, malformed delimited text, a missing header row, or an unreadable workbook. Resave as XLSX/CSV and compare headers with the template.", "常见原因包括旧式二进制 XLS、分隔文本格式错误、缺少表头或工作簿不可读。请另存为 XLSX/CSV 并与模板表头比较。"],
    ["What happens to blank or text values?", "数据包含空值或文本时怎么办？", "Blank rows are ignored. Non-numeric or non-positive time/exposure values and unrecognized statuses are excluded and shown in validation. Analysis remains disabled if no valid evidence remains.", "空行会被忽略；非数字或非正数时间/暴露值及无法识别的状态会被排除并显示在校验中。若无有效证据，分析保持禁用。"],
    ["Can I mix different time units?", "是否可以混用不同时间单位？", "No automatic conversion is performed. Convert all values to one unit before import.", "工具不会自动换算。导入前请把全部数值转换为同一单位。"]
  ]],
  ["weibull", "Weibull and Life Analysis", "Weibull 与寿命分析", [
    ["What do β values below, near, or above 1 mean?", "β 小于、等于或大于 1 分别意味着什么？", "They indicate decreasing, approximately constant, or increasing fitted failure-rate trends. They do not prove a failure mechanism.", "分别表示拟合失效率呈下降、近似恒定或上升趋势，但不能证明失效机理。"],
    ["Is η the mean life?", "η 是否等于平均寿命？", "No. In Weibull 2P, η is the time at which fitted cumulative failure reaches about 63.2%.", "不是。Weibull 2P 中，η 是拟合累计失效达到约 63.2% 的时间。"],
    ["What does B10 mean?", "B10 是什么意思？", "B10 is the fitted time by which 10% of the population has failed, subject to the model and data assumptions.", "B10 是拟合总体累计失效达到 10% 时的时间，受模型与数据假设约束。"],
    ["How are R(t) and F(t) related?", "R(t) 与 F(t) 有什么关系？", "For the same fitted model and time, F(t) = 1 − R(t).", "在同一拟合模型和时间下，F(t)=1−R(t)。"],
    ["Why do probability-plot points not lie exactly on the line?", "为什么概率图中的点不完全落在拟合线上？", "Observed plotting positions vary around a fitted model. Visual closeness alone is not a goodness-of-fit test, and this release does not provide a formal fit statistic.", "观测绘图位置会围绕拟合模型波动。视觉接近不能替代拟合优度检验，本版本也不提供正式拟合统计量。"],
    ["How do censored records affect the result?", "右删失数据会怎样影响结果？", "They contribute survival exposure without claiming an observed failure at that time and are included by the MLE fit.", "它们提供运行到该时间仍存活的证据，不宣称该时刻发生失效，并会纳入 MLE 拟合。"],
    ["Can I analyze a very small sample?", "少量样本是否可以进行 Weibull 分析？", "The engine can fit with observed failures, but fewer than five failures triggers a warning because parameter estimates may be unstable.", "只要有观察失效，引擎可能完成拟合；但失效少于五个时会警告参数估计可能不稳定。"],
    ["Should I use Weibull 2P or 3P?", "是否应该使用二参数还是三参数 Weibull？", "This tool only implements Weibull 2P. It cannot select or fit Weibull 3P; use another validated method if a location parameter is technically justified.", "本工具仅实现 Weibull 2P，不能选择或拟合 Weibull 3P。若工程上需要位置参数，应使用其他经过验证的方法。"]
  ]],
  ["mtbf", "MTBF", "MTBF", [
    ["How is MTBF different from product life?", "MTBF 与产品寿命有什么区别？", "MTBF is exposure per failure under the selected constant-rate model. It is not the failure time of an individual product or a Weibull percentile.", "MTBF 是所选恒定失效率模型下每次失效对应的暴露量，不是单个产品失效时间或 Weibull 百分位。"],
    ["Does MTBF mean the product fails at that time?", "MTBF 是否表示产品会在该时间失效？", "No. It is a population/model point estimate, not a deterministic deadline.", "不是。它是总体/模型点估计，不是确定性的失效时刻。"],
    ["How are zero failures handled?", "零失效数据如何处理？", "The tool does not output Infinity. It marks the finite MTBF point estimate as not estimable and directs target/confidence evaluation to Reliability Demonstration.", "工具不会输出 Infinity，而会把有限 MTBF 点估计标记为不可估计，并建议使用可靠性验证评估目标/置信证据。"],
    ["Can MTBF be used for non-repairable products?", "MTBF 可以用于不可维修产品吗？", "Only when accumulated exposure and a constant failure-rate model are meaningful for the engineering question. For life distributions and wear-out behavior, Life Data is usually more informative.", "仅当累计暴露和恒定失效率模型适合工程问题时使用。对于寿命分布和磨损行为，寿命数据通常更有信息。"],
    ["Can MTBF be compared directly with Weibull life?", "MTBF 结果是否可以直接与 Weibull 寿命比较？", "No. They use different model meanings and outputs. Compare only after confirming assumptions, population, units, and the metric definition.", "不能。两者模型含义和输出不同；只有确认假设、总体、单位和指标定义后才能进行有意义的比较。"]
  ]],
  ["demonstration", "Reliability Demonstration", "可靠性验证", [
    ["Which parameters are required?", "可靠性验证需要输入哪些参数？", "Requirements depend on Sample/Time and Plan/Evaluate. The form shows target reliability or MTBF, confidence, allowable failures, and the applicable sample or exposure evidence.", "参数取决于样本型/时间型和规划/评估。表单会显示目标可靠度或 MTBF、置信水平、允许失效数及相应样本或暴露证据。"],
    ["What does a zero-failure test mean?", "零失效测试意味着什么？", "It is evidence that no failures were observed during a defined sample or exposure. Its strength still depends on sample size/test time, target, confidence, and model assumptions.", "它表示在明确的样本或暴露中没有观察到失效；证据强度仍取决于样本量/时间、目标、置信水平和模型假设。"],
    ["What is the difference between confidence and reliability target?", "置信度和可靠性目标有什么区别？", "The reliability target describes required population performance; confidence describes the statistical evidence level used to demonstrate or bound that target.", "可靠性目标描述要求的总体性能；置信度描述用于验证或界定该目标的统计证据水平。"],
    ["Why is the required sample or test time large?", "为什么测试时间或样本量很大？", "High reliability, high confidence, and few allowable failures require more evidence. The exact requirement also depends on the selected sample/binomial or time/exponential method.", "高可靠度、高置信水平和较少允许失效都需要更多证据；具体要求还取决于样本/二项或时间/指数方法。"],
    ["Does a calculated plan mean the product passed?", "通过计算是否等于产品已经通过验证？", "No. Planning defines required evidence. A pass decision requires evaluating actual completed-test evidence with correct assumptions and engineering review.", "不等于。规划只是定义所需证据；通过判断需要评估真实完成试验的证据，并满足假设和工程评审。"]
  ]],
  ["alt", "Accelerated Life Testing", "加速寿命试验", [
    ["What is an acceleration factor?", "什么是加速因子？", "It generally relates life or rate between accelerated and use conditions, but this release does not calculate one.", "一般用于关联加速条件和使用条件下的寿命或速率，但当前版本不计算加速因子。"],
    ["Can stress be increased arbitrarily?", "加速条件是否可以任意提高？", "No. Excess stress can change failure mechanisms and invalidate extrapolation. This tool does not currently design or validate ALT stress levels.", "不能。过高应力可能改变失效机理并使外推失效；当前工具不设计或验证 ALT 应力水平。"],
    ["How should I choose stress conditions?", "如何选择应力条件？", "Use physics-of-failure knowledge, material limits, preliminary testing, and an externally validated model. No ALT model-selection workflow is implemented here.", "应结合失效物理、材料极限、预试验和外部验证模型。当前未实现 ALT 模型选择流程。"],
    ["How are accelerated results converted to use conditions?", "加速试验结果如何换算到使用条件？", "They are not converted by the current release. A validated acceleration relationship and mechanism consistency are required outside this tool.", "当前版本不执行换算。需要在本工具之外建立经过验证的加速关系并确认失效机理一致。"],
    ["Can results be used if the failure mechanism changes?", "如果失效机理发生变化，结果还能使用吗？", "Not for the same extrapolation without a new technical justification. The current tool provides no mechanism-change diagnostic.", "不能在没有新技术论证的情况下沿用同一外推；当前工具也不提供机理变化诊断。"]
  ]],
  ["results-reports", "Results, Charts, Reports, and Data", "结果、图表、报告与数据", [
    ["Why do chart and table values differ slightly?", "为什么图表与结果表中的数值略有差异？", "Displayed values may use different rounding precision. They should derive from the same calculated result.", "显示值可能采用不同舍入位数，但应来自同一计算结果。"],
    ["How do I view R(t) and F(t)?", "如何查看 R(t) 和 F(t)？", "In Life Data, open Reliability Curve R(t) to compare both charts or open the R(t)/F(t) table for selected times.", "在寿命数据中打开“可靠性曲线 R(t)”比较两张图，或打开 R(t)/F(t) 表查看选定时间。"],
    ["Why did results change greatly after replacing data?", "为什么更换数据后结果发生明显变化？", "Parameter estimates can be sensitive to failure count, censoring, range, outliers, mixed mechanisms, and test conditions. Review validation and data representativeness.", "参数估计可能对失效数、删失、范围、异常值、混合机理和试验条件敏感。请复核校验和数据代表性。"],
    ["Can a chart be used directly as release evidence?", "图表可以直接作为放行证据吗？", "No. A chart is one analysis artifact and must be reviewed with source data, assumptions, uncertainty, test design, and applicable acceptance criteria.", "不能。图表只是分析材料之一，必须结合源数据、假设、不确定性、试验设计和适用接受准则评审。"],
    ["Why are some results not displayed?", "为什么某些结果没有显示？", "The selected tab may be inactive, required inputs may be missing, the metric may be non-estimable, or the feature may not be implemented. The panel message states the applicable reason.", "可能是对应页签未选中、缺少输入、指标不可估计或功能尚未实现；面板消息会说明原因。"],
    ["How do I export a report?", "如何导出报告？", "After a supported analysis, open Data Summary and use Export HTML, Export PDF, or Print.", "完成支持的分析后，打开“数据摘要”，使用导出 HTML、导出 PDF 或打印。"],
    ["Why might a report differ from the page?", "报告为什么与页面显示不一致？", "The report reflects the last completed analysis and language when it was generated. Rerun after changing data/settings, then export again.", "报告反映生成时最后一次完成的分析和语言。修改数据/设置后请重新运行并再次导出。"],
    ["Must I rerun after changing data?", "修改数据后是否需要重新分析？", "Yes. Input changes invalidate the previous result; rerun before interpreting or exporting.", "需要。输入变化会使旧结果失效，解读或导出前应重新运行。"],
    ["Is my data saved or uploaded?", "我的数据是否会被保存或上传？", "Life Data inputs are sent to the configured Reliability Backend for calculation. The current Backend does not retain input data and does not use an account, application database, third-party AI, or external analysis service. MTBF and Demonstration retain their current browser workflows. Assess the actual deployment before using confidential data.", "寿命数据输入会发送至已配置的 Reliability Backend 进行计算；当前 Backend 不保留输入数据，也不使用账户、应用数据库、第三方 AI 或外部分析服务。MTBF 与可靠性验证继续保留当前浏览器流程。处理机密数据前仍应评估实际部署。"],
    ["Can the exported report serve as a formal verification report?", "导出的报告可以作为正式验证报告吗？", "It can support an engineering record, but it is not automatically approved or compliant. Formal use requires controlled review, traceability, applicable procedures, and authorization.", "它可以作为工程记录材料，但不会自动获批或合规。正式使用需要受控评审、可追溯性、适用程序和授权。"]
  ]]
];

function localizeFaq(lang) {
  return faqSeed.map(([id, enTitle, zhTitle, items]) => ({
    id,
    title: lang === "zh" ? zhTitle : enTitle,
    items: items.map(([idQuestion, zhQuestion, enAnswer, zhAnswer], index) => ({
      id: `${id}-${index + 1}`,
      question: lang === "zh" ? zhQuestion : idQuestion,
      answer: lang === "zh" ? zhAnswer : enAnswer
    }))
  }));
}

export function getManualContent(lang = "en") {
  return manual[lang === "zh" ? "zh" : "en"];
}

export function getFaqContent(lang = "en") {
  const normalized = lang === "zh" ? "zh" : "en";
  return {
    title: normalized === "zh" ? "FAQ" : "FAQ",
    subtitle: normalized === "zh" ? "按当前功能边界查找操作与结果解读问题。" : "Find operating and interpretation guidance within the current feature boundary.",
    searchLabel: normalized === "zh" ? "搜索 FAQ" : "Search FAQ",
    searchPlaceholder: normalized === "zh" ? "搜索问题或答案" : "Search questions or answers",
    empty: normalized === "zh" ? "没有匹配的问题，请尝试其他关键词。" : "No matching questions. Try another keyword.",
    categories: localizeFaq(normalized)
  };
}

export function filterFaqContent(content, query = "") {
  const normalized = String(query).trim().toLocaleLowerCase();
  if (!normalized) return content.categories;
  return content.categories
    .map(category => ({
      ...category,
      items: category.items.filter(item =>
        `${item.question} ${item.answer}`.toLocaleLowerCase().includes(normalized)
      )
    }))
    .filter(category => category.items.length);
}
