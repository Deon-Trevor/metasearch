const fetch = require('node-fetch')
const cheerio = require('cheerio')
const { performance } = require('perf_hooks')

async function requestRaw(url) {
	const response = await fetch(url, {
		headers: {
			'user-agent': 'Mozilla/5.0 Firefox/84.0'
		}
	})
	const text = await response.buffer()
	return text
}

async function requestJSON(url) {
	return JSON.parse(await requestRaw(url))
}

async function requestDom(url) {
	const htmlResponse = await requestRaw(url)
	return cheerio.load(htmlResponse)
}

function get(dom, query) {
	if (dom.find)
		return dom.find(query)
	else
		return dom(query)
}

function getElements(dom, query) {
	const elements = get(dom, query)
	const results = []

	for (const element of elements.get()) {
		results.push(get(dom, element))
	}
	return results
}

function extractText(dom, query) {
	const element = get(dom, query)
	if (element[0] && element[0].name == 'ol') {
		// if it's a list, number it and add newlines
		let listTexts = []
		let listItems = getElements(element, 'li')
		for (let listItemIndex in listItems) {
			let listItem = listItems[listItemIndex]
			let displayedIndex = parseInt(listItemIndex)+1
			listTexts.push(displayedIndex + '. ' + listItem.text().trim())
		}
		return listTexts.join('\n')
	}
	return element.text().trim()
}

function extractAttribute(dom, query, attribute) {
	const element = get(dom, query)
	return element.attr(attribute)
}

function extractHref(dom, query) {
	return extractAttribute(dom, query, 'href')
}

// for google, bing, etc
async function parseResultList(url, {
	resultItemPath,
	titlePath,
	hrefPath,
	contentPath,
	suggestionPath,

	featuredSnippetPath,
	featuredSnippetContentPath,
	featuredSnippetTitlePath,
	featuredSnippetHrefPath,

}) {
	const $ = await requestDom(url)

	const results = []

	const resultElements = getElements($, resultItemPath)
	
	var featuredSnippetContent = null
	var featuredSnippetTitle = null
	var featuredSnippetUrl = null


	for (const resultItemIndex in resultElements) {
		const resultItemEl = resultElements[resultItemIndex]
		const resultTitle = extractText(resultItemEl, titlePath)
		if (!resultTitle) continue
		const resultUrl = extractHref(resultItemEl, hrefPath)
		if (resultUrl.startsWith('https://duckduckgo.com/y.js'))
			continue
		const resultContent = extractText(resultItemEl, contentPath)


		if (featuredSnippetPath) {
			const featuredSnippetEl = $(featuredSnippetPath)
			if (featuredSnippetEl.length > 0) {
				featuredSnippetContent = extractText(featuredSnippetEl, featuredSnippetContentPath)
				featuredSnippetTitle = extractText(featuredSnippetEl, featuredSnippetTitlePath)
				featuredSnippetUrl = extractHref(featuredSnippetEl, featuredSnippetHrefPath)
			}
		}
	

		results.push({
			title: resultTitle,
			url: resultUrl,
			content: resultContent,
			position: parseInt(resultItemIndex) + 1 // starts at 1
		})
	}
	return {
		results,
		answer: featuredSnippetContent !== null ? {
			content: featuredSnippetContent,
			title: featuredSnippetTitle,
			url: featuredSnippetUrl,
		} : null
	}
}

module.exports = { requestRaw, parseResultList, requestJSON, requestDom, getElements, extractText, extractAttribute, get, extractHref }

