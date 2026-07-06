const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

function getClassName(index) {
	let name = ''
	let value = index

	do {
		name = `${alphabet[value % alphabet.length]}${name}`
		value = Math.floor(value / alphabet.length) - 1
	} while (value >= 0)

	return name
}

function collectGeneratedClassNames(root) {
	const classNames = new Set()

	function visit(node) {
		if (node.type === 'element') {
			const className = node.attributes.class

			if (className) {
				for (const name of className.split(/\s+/)) {
					if (/^cls-\d+$/.test(name)) {
						classNames.add(name)
					}
				}
			}

			if (node.name === 'style') {
				for (const child of node.children) {
					if (child.type !== 'text') {
						continue
					}

					for (const match of child.value.matchAll(/\.cls-\d+/g)) {
						classNames.add(match[0].slice(1))
					}
				}
			}
		}

		for (const child of node.children ?? []) {
			visit(child)
		}
	}

	visit(root)

	return new Map([...classNames].sort().map((name, index) => [name, getClassName(index)]))
}

const minifyGeneratedClassNames = {
	name: 'minifyGeneratedClassNames',
	fn(root) {
		const classNames = collectGeneratedClassNames(root)

		if (classNames.size === 0) {
			return null
		}

		return {
			element: {
				enter(node) {
					const className = node.attributes.class

					if (className) {
						node.attributes.class = className
							.split(/\s+/)
							.map(name => classNames.get(name) ?? name)
							.join(' ')
					}

					if (node.name !== 'style') {
						return
					}

					for (const child of node.children) {
						if (child.type !== 'text') {
							continue
						}

						for (const [from, to] of classNames) {
							child.value = child.value.replaceAll(`.${from}`, `.${to}`)
						}
					}
				},
			},
		}
	},
}

/**
 * @type {import('svgo').Config}
 */
export default {
	multipass: true,
	plugins: [
		{
			name: 'preset-default',
		},
		{
			name: 'removeAttrs',
			params: {
				attrs: ['svg:id', 'data-name'],
			},
		},
		minifyGeneratedClassNames,
	],
	js2svg: {
		indent: 0,
		pretty: false,
		eol: 'lf',
		finalNewline: false,
		useShortTags: true,
	},
}
