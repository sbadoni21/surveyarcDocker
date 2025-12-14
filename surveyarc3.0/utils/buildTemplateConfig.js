// utils/buildTemplateConfig.js
export function buildTemplateConfig(templateId, orgId, surveyId) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const baseUrl = `${origin}/form?org_id=${orgId}&survey_id=${surveyId}`;

  const base = {
    source_name: "",
    source_type: "external",
    description: "",
    is_active: true,
    expected_completes: "",
    expected_incidence_rate: "",
    url_variables: [],
    meta_data: { provider: templateId },
    exit_defaults: {
      qualified: "",
      terminated: "",
      quota_full: "",
    },
  };

  switch (templateId) {
    case "veridata":
      return {
        ...base,
        source_name: "Veridata",
        source_type: "internal",
        description: "Veridata / SampleTap panel integration",
        url_variables: [
          {
            var_name: "v",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "Veridata unique respondent identifier",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "veridata",
          docs_url: "https://surveys.sampletap.com/",
          required_params: ["v"],
        },
        exit_defaults: {
          terminated: "https://surveys.sampletap.com/returning/t?v=${v}",
          qualified: "https://surveys.sampletap.com/returning/c?v=${v}",
          quota_full: "https://surveys.sampletap.com/returning/qta?v=${v}",
        },
      };

    case "purespectrum":
      return {
        ...base,
        source_name: "PureSpectrum",
        source_type: "internal",
        description: "PureSpectrum panel integration",
        url_variables: [
          {
            var_name: "transaction_id",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "PureSpectrum transaction ID",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
          {
            var_name: "ps_hash",
            var_value: "",
            required: "required",
            authentication: "no_authentication",
            description: "PureSpectrum hash for qualified completes",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "purespectrum",
          docs_url: "https://spectrumsurveys.com/",
          required_params: ["transaction_id", "ps_hash"],
        },
        exit_defaults: {
terminated: "https://spectrumsurveys.com/surveydone?st=18&transaction_id=${transaction_id}",
          qualified: "https://spectrumsurveys.com/surveydone?st=21&ps_hash=${ps_hash}&transaction_id=${transaction_id}",
          quota_full: "https://spectrumsurveys.com/surveydone?st=17&transaction_id=${transaction_id}",
        },
      };

    case "lynk":
      return {
        ...base,
        source_name: "Lynk Global",
        source_type: "internal",
        description: "Lynk Global panel integration",
        url_variables: [
          {
            var_name: "pid",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "Lynk participant ID",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "lynk",
          docs_url: "https://surveys.lynk.global/",
          required_params: ["pid"],
        },
        exit_defaults: {
          terminated: "https://surveys.lynk.global/simpleProcess.php?status=2&pid=${pid}",
          qualified: "https://surveys.lynk.global/simpleProcess.php?status=1&pid=${pid}",
          quota_full: "https://surveys.lynk.global/simpleProcess.php?status=3&pid=${pid}",
        },
      };

    case "repdata":
      return {
        ...base,
        source_name: "RepData",
        source_type: "internal",
        description: "RepData panel integration",
        url_variables: [
          {
            var_name: "rid",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "RepData respondent ID",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "repdata",
          docs_url: "https://www.rdsecured.com/",
          required_params: ["rid"],
        },
        exit_defaults: {
          terminated: "https://www.rdsecured.com/return?inbound_code=2000&rid=${rid}",
          qualified: "https://www.rdsecured.com/return?inbound_code=1000&rid=${rid}",
          quota_full: "https://www.rdsecured.com/return?inbound_code=4000&rid=${rid}",
        },
      };

    case "maven":
      return {
        ...base,
        source_name: "Maven",
        source_type: "internal",
        description: "Maven panel integration",
        url_variables: [
          {
            var_name: "UNIQUEID",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "Maven unique participant ID",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "maven",
          docs_url: "https://app.maven.co/",
          required_params: ["UNIQUEID"],
        },
        exit_defaults: {
          terminated: "https://app.maven.co/panel-offer/${UNIQUEID}/unqualify",
          qualified: "https://app.maven.co/panel-offer/${UNIQUEID}/complete",
          quota_full: "https://app.maven.co/panel-offer/${UNIQUEID}/unqualify",
        },
      };

    case "innovate":
      return {
        ...base,
        source_name: "InnovateMR",
        source_type: "internal",
        description: "InnovateMR panel integration",
        url_variables: [
          {
            var_name: "tk",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "InnovateMR token",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
          {
            var_name: "ejid",
            var_value: "",
            required: "required",
            authentication: "no_authentication",
            description: "InnovateMR job ID (required for qualified)",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "innovate",
          docs_url: "https://edgeapi.innovatemr.net/",
          required_params: ["tk", "ejid"],
        },
        exit_defaults: {
          terminated: "https://edgeapi.innovatemr.net/surveyDone?sc=2&tk=${tk}",
          qualified: "https://edgeapi.innovatemr.net/surveyDone?sc=1&ejid=${ejid}&tk=${tk}",
          quota_full: "https://edgeapi.innovatemr.net/surveyDone?sc=3&tk=${tk}",
        },
      };

    case "emporia":
      return {
        ...base,
        source_name: "Emporia Research",
        source_type: "internal",
        description: "Emporia Research panel integration",
        url_variables: [
          {
            var_name: "uid",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "Emporia user ID",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "emporia",
          docs_url: "https://app.emporiaresearch.com/",
          required_params: ["uid"],
        },
        exit_defaults: {
          terminated: "https://app.emporiaresearch.com/survey/terminated?uid=${uid}",
          qualified: "https://app.emporiaresearch.com/survey/qualified?uid=${uid}",
          quota_full: "https://app.emporiaresearch.com/survey/quotafull?uid=${uid}",
        },
      };

    case "grapedata":
      return {
        ...base,
        source_name: "GrapeData",
        source_type: "internal",
        description: "GrapeData panel integration",
        url_variables: [
          {
            var_name: "responseId",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "GrapeData response ID",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
          {
            var_name: "type",
            var_value: "",
            required: "required",
            authentication: "no_authentication",
            description: "GrapeData type parameter",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "grapedata",
          docs_url: "https://user-app.grape-data.com/",
          required_params: ["responseId", "type"],
        },
        exit_defaults: {
          terminated: "https://user-app.grape-data.com/redirect?responseId=${responseId}&gc=0&type=${type}",
          qualified: "https://user-app.grape-data.com/redirect?responseId=${responseId}&gc=1&type=${type}",
          quota_full: "https://user-app.grape-data.com/redirect?responseId=${responseId}&gc=2&type=${type}",
        },
      };

    case "dialecticanet":
      return {
        ...base,
        source_name: "Dialecticanet",
        source_type: "internal",
        description: "Dialecticanet panel integration",
        url_variables: [
          {
            var_name: "uid",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "Dialecticanet user ID",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
          {
            var_name: "state",
            var_value: "",
            required: "required",
            authentication: "no_authentication",
            description: "Dialecticanet state parameter",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "dialecticanet",
          docs_url: "https://surveys.dialecticanet.com/",
          required_params: ["uid", "state"],
        },
        exit_defaults: {
          terminated: "https://surveys.dialecticanet.com/survey/selfserve/3528/240585?list=1&uid=${uid}&state=${state}&hDStatus=2",
          qualified: "https://surveys.dialecticanet.com/survey/selfserve/3528/240585?list=1&uid=${uid}&state=${state}&hDStatus=1",
          quota_full: "https://surveys.dialecticanet.com/survey/selfserve/3528/240585?list=1&uid=${uid}&state=${state}&hDStatus=3",
        },
      };

    case "colemanrg":
      return {
        ...base,
        source_name: "Coleman Research Group",
        source_type: "internal",
        description: "Coleman Research Group panel integration",
        url_variables: [],
        meta_data: {
          provider: "colemanrg",
          docs_url: "https://www.colemanrg.com/",
          required_params: [],
        },
        exit_defaults: {
          terminated: "https://www.colemanrg.com/survey_screenout/",
          qualified: "https://www.colemanrg.com/survey_completed/",
          quota_full: "https://www.colemanrg.com/survey_overquota/",
        },
      };

    case "borderless":
      return {
        ...base,
        source_name: "Borderless / The Panel Station",
        source_type: "internal",
        description: "Borderless panel integration",
        url_variables: [
          {
            var_name: "id",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "Borderless participant ID",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "borderless",
          docs_url: "https://surveys.thepanelstation.com/",
          required_params: ["id"],
        },
        exit_defaults: {
          terminated: "https://surveys.thepanelstation.com/survey/0BAA4B8B02553046D5D00883ADA19CEA/id=${id}/rst=EP20924JC23809AX",
          qualified: "https://surveys.thepanelstation.com/survey/0BAA4B8B02553046D5D00883ADA19CEA/id=${id}/rst=EP20924JC23809AX",
          quota_full: "https://surveys.thepanelstation.com/survey/0BAA4B8B02553046D5D00883ADA19CEA/id=${id}/rst=EP20924JC23809AX",
        },
      };

    case "questionlab":
      return {
        ...base,
        source_name: "QuestionLab",
        source_type: "internal",
        description: "QuestionLab panel integration",
        url_variables: [
          {
            var_name: "arid",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "QuestionLab audience respondent ID",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "questionlab",
          docs_url: "https://vault.questionlab.com/",
          required_params: ["arid"],
        },
        exit_defaults: {
          terminated: "https://vault.questionlab.com/audience/passback?creference=TWpneUl5TlVTRk09&status=2&arid=${arid}",
          qualified: "https://vault.questionlab.com/audience/passback?creference=TWpneUl5TlVTRk09&status=1&arid=${arid}",
          quota_full: "https://vault.questionlab.com/audience/passback?creference=TWpneUl5TlVTRk09&status=3&arid=${arid}",
        },
      };

    case "exactinsight":
      return {
        ...base,
        source_name: "ExactInsight",
        source_type: "internal",
        description: "ExactInsight panel integration",
        url_variables: [
          {
            var_name: "pid",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "ExactInsight participant ID",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "exactinsight",
          docs_url: "https://www.exactinsight.ai/",
          required_params: ["pid"],
          project_id: "93",
        },
        exit_defaults: {
          terminated: "https://www.exactinsight.ai/survey/callback?project=93&status=terminate&pid=${pid}",
          qualified: "https://www.exactinsight.ai/survey/callback?project=93&status=complete&pid=${pid}",
          quota_full: "https://www.exactinsight.ai/survey/callback?project=93&status=quota&pid=${pid}",
        },
      };

    case "dynata":
      return {
        ...base,
        source_name: "Dynata",
        source_type: "internal",
        description: "Dynata / SSI programmatic panel",
        url_variables: [
          {
            var_name: "psid",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "Dynata respondent ID (psid, unique per respondent)",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "dynata",
          docs_url: "https://www.dynata.com/",
          required_params: ["psid"],
          note: "Replace XXXX with your project ID and use actual keyId and endsignature from Dynata",
        },
        exit_defaults: {
          qualified: "https://dkr1.ssisurveys.com/projects/end?rst=1&psid=${psid}&_k={keyId}&_s={endsignature}",
          terminated: "https://dkr1.ssisurveys.com/projects/end?rst=2&psid=${psid}&_k={keyId}&_s={endsignature}",
          quota_full: "https://dkr1.ssisurveys.com/projects/end?rst=3&psid=${psid}&_k={keyId}&_s={endsignature}",
        },
      };

    case "cint":
      return {
        ...base,
        source_name: "Cint",
        source_type: "internal",
        description: "Cint panel integration",
        url_variables: [],
        meta_data: { provider: "cint", docs_url: "https://cint.com/" },
        exit_defaults: {
          terminated: "https://s.cint.com/Survey/EarlyScreenOut",
          quota_full: "https://s.cint.com/Survey/QuotaFull",
          qualified: "https://s.cint.com/Survey/Complete",
        },
      };

    case "lucid":
      return {
        ...base,
        source_name: "Lucid",
        source_type: "internal",
        description: "Lucid panel integration",
        url_variables: [
          {
            var_name: "PID",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "Lucid participant ID",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: { provider: "lucid", docs_url: "https://luc.id/" },
        exit_defaults: {
          qualified: "https://www.samplicio.us/router/ClientSurveyFinish.aspx?psid=[%PID%]",
          terminated: "https://www.samplicio.us/router/ClientSurveyScreenout.aspx?psid=[%PID%]",
          quota_full: "https://www.samplicio.us/router/ClientSurveyQuotaFull.aspx?psid=[%PID%]",
        },
      };

    case "azure":
      return {
        ...base,
        source_name: "Azure",
        source_type: "internal",
        description: "Azure / Xurway style integration",
        url_variables: [
          {
            var_name: "trans_id",
            var_value: "",
            required: "unique",
            authentication: "no_authentication",
            description: "Transaction ID (unique per respondent)",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
          {
            var_name: "projectid",
            var_value: "",
            required: "required",
            authentication: "no_authentication",
            description: "Panel project id",
            default_value: null,
            validation_regex: null,
            mapped_to: null,
          },
        ],
        meta_data: {
          provider: "azure",
          docs_url: "https://host1.xurway.com/",
          required_params: ["trans_id", "projectid"],
        },
        exit_defaults: {
          terminated: "https://host1.xurway.com/StaticRedirect/client_page.asp?trans_id=${trans_id}&s=2&projectid=${projectid}",
          quota_full: "https://host1.xurway.com/StaticRedirect/client_page.asp?trans_id=${trans_id}&s=3&projectid=${projectid}",
          qualified: "https://host1.xurway.com/StaticRedirect/client_page.asp?trans_id=${trans_id}&s=1&projectid=${projectid}",
        },
      };

    case "file":
      return {
        ...base,
        source_name: "File / CSV Upload",
        source_type: "file",
        description: "Static list via CSV/Excel upload",
        url_variables: [],
        meta_data: { provider: "file" },
        exit_defaults: { qualified: "", terminated: "", quota_full: "" },
      };

    case "custom_external":
    default:
      return {
        ...base,
        source_name: "Custom External Panel",
        source_type: "external",
        description: "Custom external partner integration",
        url_variables: [],
        meta_data: { provider: "custom_external" },
        exit_defaults: {
          qualified: "https://PARTNER_COMPLETE_URL?status=complete&rid={respondent_id}",
          terminated: "https://PARTNER_TERMINATE_URL?status=terminate&rid={respondent_id}",
          quota_full: "https://PARTNER_QUOTAFULL_URL?status=quotafull&rid={respondent_id}",
        },
      };
  }
}