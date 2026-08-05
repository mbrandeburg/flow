const fm = require('gray-matter')

module.exports = async function (src) {
  const callback = this.async()
  const { content, data } = fm(src)

  const code =
    // MDX files live in src/pages, so these imports are relative to that dir.
    `import {withLayout} from '../components';
export {getStaticProps} from '../mdxStaticProps';

export default withLayout(${JSON.stringify(data)})

` + content

  return callback(null, code)
}
