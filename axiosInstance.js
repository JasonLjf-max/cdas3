import axios from "axios"
import GlobalConfig from "@/globalConfig"
import { secToMs } from "@/utils/method/method"
import { userStore } from "@/plugins/store/user"
import { successMsg, errorMsg, warningMsg, asyncMsg } from "@/utils/elementplus/message"

const { Http: { BaseUrl: baseURL = "", Timeout = 10 } } = GlobalConfig

const http = axios.create({
	baseURL,
	timeout: secToMs(Timeout),
	headers: {
		"Content-Type": "application/x-www-form-urlencoded"
	}
})

// 请求拦截器
http.interceptors.request.use(config => {
	const { userToken = "" } = userStore()
	if (userToken) {
		config.headers.Authorization = "Bearer" + userToken
	}
	return config
}, error => {
	return Promise.reject(error)
})

// 响应拦截器
http.interceptors.response.use(
	response => {
		return response.data
	},
	error => {
		if (error && error?.response) {
			const { status } = error.response
			switch (status) {
				case 400: errorMsg("请求出错"); break
				case 401: errorMsg("未授权，请重新登录"); break
				case 403: errorMsg("拒绝访问"); break
				case 404: errorMsg("请求错误，未找到该资源"); break
				case 408: errorMsg("请求超时"); break
				case 500: errorMsg("服务器内部错误"); break
				case 501: errorMsg("服务未实现"); break
				case 502: errorMsg("网关错误"); break
				case 503: errorMsg("服务不可用"); break
				case 504: errorMsg("网关超时"); break
				case 505: errorMsg("HTTP版本不受支持"); break
			}
		} else if (error.message.includes("timeout")) {
			errorMsg("请求超时")
		} else {
			errorMsg("连接服务器失败")
		}
		return Promise.reject(error)
	}
)

/**
 * 封装请求方法
 * @param method 请求方法
 * @param url 请求url
 * @param data 请求数据
 * @param config 请求配置
 * @param options 额外选项（needMsg, msgType, message）
 */
// const request = async (method, url, data, config = {}, { needMsg = false, msgBackType = "all", msgType, message: { successMessage: successMsg1, errorMessage: errorMsg1 } = {} } = {}) => {
// 	console.log(data);
// 	const res = await http({ method, url, [method === "get" ? "param" : "data"]: data, ...config })
// 	const isSuccess = res.code == 200
// 	const shouldShowMessage = needMsg && (msgBackType == "all" || isSuccess ? msgBackType == "success" : msgBackType == "error")
// 	const { successMessage: successMsg2, errorMessage: errorMsg2 } = typeToLoadingMessageMap(msgType)
// 	const { successMessage = "", errorMessage = "" } = needMsg ? {
// 		successMessage: successMsg1 || successMsg2,
// 		errorMessage: errorMsg1 || errorMsg2
// 	} : {}
// 	if (shouldShowMessage) {
// 		isSuccess ? successMsg(successMessage) : errorMsg(errorMessage)
// 	}
// 	return isSuccess ? res : { ...res, data: undefined }
// }

const request = (method, url, data, config = {}, { needMsg = false, msgBackType = "all", msgType, message: { successMessage, errorMessage } = {} }) => {

	let finalMessage = needMsg ? {
		successMessage: successMessage ?? typeToLoadingMessageMap[msgType]?.successMessage,
		errorMessage: errorMessage ?? typeToLoadingMessageMap[msgType]?.errorMessage
	} : {}

	return http({ method, url, [method === "get" ? "params" : "data"]: data, ...config }).then(res => {
		if (res?.code == 200) {
			if (msgBackType == "all" || msgBackType == "success") {
				needMsg && successMsg(res.message ?? finalMessage.successMessage)
			}
			return res;
		} else {
			if (msgBackType == "all" || msgBackType == "error") {
				needMsg && errorMsg(res.message ?? finalMessage.errorMessage)
			}
			return {
				...res,
				data: undefined
			}
		}
	})
}

const get = async (url, data, config = {}, { needMsg = true, msgBackType = "error", msgType = "query", message } = {}) => {
	return await request("get", url, data, config, { needMsg, msgBackType, msgType, message })
}

const post = async (url, data, config = {}, { needMsg = true, msgBackType = "error", msgType = "query", message } = {}) => {
	return await request("post", url, data, config, { needMsg, msgBackType, msgType, message })
}

const put = async (url, data, config = {}, { needMsg = true, msgBackType = "error", msgType = "query", message } = {}) => {
	return await request("put", url, data, config, { needMsg, msgBackType, msgType, message })
}

const del = async (url, data, config = {}, { needMsg = true, msgBackType = "error", msgType = "delete", message } = {}) => {
	return await request("delete", url, data, config, { needMsg, msgBackType, msgType, message })
}

const requestMethods = {
	get, post, put, delete: del
}

// 消息模版
const baseMessages = {
	loading: "中...",
	success: "成功",
	error: "失败"
}
const actionVerbs = {
	add: "添加",
	update: "修改",
	delete: "删除",
	reset: "重置",
	distribution: "分配",
	verify: "验证",
	login: "登录",
	print: "打印",
	save: "保存",
	set: "设置",
	query: "查询",
	return: "退回",
	nc: "NC",
	report: "报工",
	download: "下载",
	default: "操作"	// 默认
}
const loadingMessageMap = computed(() => {
	return Object.entries(actionVerbs).reduce((map, [type, verb]) => {
		map[type] = {
			loadingMessage: `${verb}${baseMessages.loading}`,
			successMessage: `${verb}${baseMessages.success}`,
			errorMessage: `${verb}${baseMessages.error}`
		}
		return map
	}, {})
})

const typeToLoadingMessageMap = (type) => {
	return loadingMessageMap.value[type] || loadingMessageMap.value.default
}

const asyncRequest = async (method, url, data, msgType, { config = {}, callbackFn, callbackTriggerWay = "success", message: { loadingMessage: loadingMsg1, successMessage: successMsg1, errorMessage: errorMsg1 } = {} } = {}) => {

	const { loadingMessage: loadingMsg2, successMessage: successMsg2, errorMessage: errorMsg2 } = typeToLoadingMessageMap(msgType)
	const finalMessage = {
		loadingMessage: loadingMsg1 || loadingMsg2,
		successMessage: successMsg1 || successMsg2,
		errorMessage: errorMsg1 || errorMsg2
	}
	return await asyncMsg(() => requestMethods[method](url, data, config, { needMsg: false }), finalMessage).then(res => {
		const shouldTrigger = (callbackTriggerWay == "success" && res.code == 200) || (callbackTriggerWay == "error" && res.code != 200) || (callbackTriggerWay == "any")
		if (shouldTrigger) {
			callbackFn?.(res)
		}
		return res
	})
}

export { get, post, put, del, asyncRequest }