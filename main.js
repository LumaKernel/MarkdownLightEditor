const makeONE = (RIGHT, ESCAPED_RIGHT) => RIGHT.length == 1 ? `[^${ESCAPED_RIGHT}]` : "[\\s\\S]"
const makeTeXRegExp = (ESCAPED_LEFT, ESCAPED_RIGHT, ONE) => new RegExp(
  String.raw`${ESCAPED_LEFT}((?:${ONE}(?!${ESCAPED_RIGHT}))*${ONE})${ESCAPED_RIGHT}`,
  "g"
)

const escapes = {}
const decodes = {}

const DISP_RETURN = "   "

escapes.hatena = (src, left, right, disp) => {

	const ESCAPED_LEFT = RegExpEscape(left)
  const ESCAPED_RIGHT = RegExpEscape(right)

  const ONE = makeONE(right, ESCAPED_RIGHT)
  const TeXRegExp = makeTeXRegExp(ESCAPED_LEFT, ESCAPED_RIGHT, ONE)

	if(!disp)
    return src
        .split("\n")
        .map(line => {
          return line.replace(TeXRegExp, (_, str) => {
            return `[tex:${HatenaEscape(str)}]`
          })
        })
        .join("\n")
  else
    return src.replace(TeXRegExp, (orig, str) => {
        if(str.match(/\n\n/)) return orig
        str = DISP_RETURN + "\\displaystyle" + str.replace(/\n/g, DISP_RETURN);
        return `[tex:${HatenaEscape(str)}]`
      })

  function HatenaEscape(str) {  
    return str
    .replace(/[_^*\\]/g, '\\$&')
    .replace(/[\[\]]/g, '\\\\$&')
  }
}

function RegExpEscape(str) {  
  return str
  .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}


decodes.hatena = (src, vue) => {
	const HatenaTeXRegExp = /\[tex:((?:\\\\\]|\\(?!\])|[^\n\]\\])*\n?(?:\\\\\]|\\(?!\])|[^\n\]\\])*)\]/gi

	const DispRegExp = /^   \\\\displaystyle(.*)/

	return src.replace(HatenaTeXRegExp, (orig, str) => {
  		if(str) str = str.replace(/\n/g, "")
    	if(!str) return orig
      if(str.match(DispRegExp)){
      	str = str.replace(DispRegExp, "$1")
     		str = str
        	.replace(new RegExp(DISP_RETURN, "g"), "\n")
          .replace(/\n+/, "\n")
        return `${vue.d_left}${HatenaDecode(str)}${vue.d_right}`
      } else
    		return `${vue.in_left}${HatenaDecode(str)}${vue.in_right}`
    })

  function HatenaDecode(str) {
    return str
    .replace(/\\([\\\]\[^*_])/g, '$1')
    .replace(/\\([\[\]])/g, '$1')
  }
}


function unescape(src, left, right, disp) {

	const ESCAPED_LEFT = RegExpEscape(left)
  const ESCAPED_RIGHT = RegExpEscape(right)

  const ONE = makeONE(right, ESCAPED_RIGHT)
  const TeXRegExp = makeTeXRegExp(ESCAPED_LEFT, ESCAPED_RIGHT, ONE)

	if(!disp)
    return src
      .split("\n")
      .map(line => {
        return line.replace(TeXRegExp, (_, str) => {
          return `${left}${markedUnscape(str)}${right}`
        })
      })
      .join("\n")
  else
  	return src
        .replace(TeXRegExp, (_, str) => {
          return `${left}${str}${right}`
        })
}

function markedUnscape (str) {
	return str
  	.replace(/[\\*^_\[\]]/g, "\\$&")
}

function previewHTML(vue) {
	let input = vue.input
  vue.separators.forEach(([l, r, d]) => {input = unescape(input, l, r, d)})
  return marked(input, {pedantic: true})
}

const renderer = {}

renderer.mathjax = (vue) => {
  MathJax.Hub.Config({
    extensions: ["tex2jax.js"],
    jax: ["input/TeX", "output/HTML-CSS"],
    tex2jax: {
      inlineMath: [ [vue.in_left,vue.in_right] ],
      displayMath: [ [vue.d_left,vue.d_right] ],
      processEscapes: true,
    },"HTML-CSS": { fonts: ["TeX"] },
    skipStartupTypeset: true
  })
  MathJax.Hub.Queue(["Typeset", MathJax.Hub,vue.$refs.preview])
  /* MathJax.Hub.Queue(["Reprocess", MathJax.Hub,vue.$refs.preview]) */
}

renderer.katex = (vue) => {
  const delimiters = []
  vue.separators.forEach(
  	([left, right, display]) =>
    	delimiters.push({left, right, display})
	)
  renderMathInElement(vue.$refs.preview, {
    delimiters
  })
}

const _renderPreview = vue => {
  vue.preview = previewHTML(vue)
  Vue.nextTick().then(() => {
  	renderer[vue.renderer](vue)
  })
}

const renderPreview = _.throttle(_renderPreview, 200)

const checkKeys = ["in_left", "in_right", "d_left", "d_right", "target", "renderer"]

new Vue({
  el: '#app',
  data: {
    input: String.raw``,
    escaped : '',
    preview: '',
    in_left: '$',
    in_right: '$',
    d_left: '$$',
    d_right: '$$',
    target: 'hatena',
    renderer: 'katex',
  },
  watch: {
  	input() {
    	this.saveLocalData()
    },
  	target() {
    	this.changeInput()
    },
  	renderer() {
    	this.changeInput()
    },
  },
  computed: {
  	separators() {
    	return [
        [this.in_left, this.in_right, false],
        [this.d_left, this.d_right, true]]
      	.sort(([a], [b]) => b.length - a.length)
		}
  },
  methods: {
  	changeInput() {
    	let res = this.input
      this.separators.forEach(([l, r, d]) =>
      	{res = escapes[this.target](res, l, r, d)})
      this.escaped = res
      this.updatePreview()
    },
  	changeEscaped() {
      this.input = decodes[this.target](this.escaped, this)
      this.updatePreview()
    },
    updatePreview() {
    	renderPreview(this)
		},
    loadLocalData() {
    	const localStorage = window.localStorage
    	if(!localStorage) return
      let data = localStorage.getItem("data")
      if(data) this.input = data
    },
    loadLocalSetting() {
    	const localStorage = window.localStorage
    	if(!localStorage) return
      let data = localStorage.getItem("setting")
      try {
        data = JSON.parse(data)
      } catch(e) { data = {} }
      checkKeys.forEach(key => {
      	try{
      		if(data[key]) this[key] = data[key]
        } catch(e) {}
      })
    },
    saveLocalData() {
    	const localStorage = window.localStorage
    	if(!localStorage) return
      localStorage.setItem("data", this.input)
    },
    saveLocalSetting() {
    	const localStorage = window.localStorage
    	if(!localStorage) return
      const data = {}
      checkKeys.forEach(key => {data[key] = this[key]})
      localStorage.setItem("setting", JSON.stringify(data))
    },
  },
  mounted() {
  	this.loadLocalSetting()
  	this.loadLocalData()
  	this.changeInput()
  }
})


