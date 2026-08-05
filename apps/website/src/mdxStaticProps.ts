import type { GetStaticProps } from 'next'
import ntLoadNamespaces from 'next-translate/loadNamespaces'

import i18nConfig from '../i18n'

// Shared getStaticProps for MDX pages: next-translate-plugin does not process
// .mdx files, so load the namespace here to keep them statically generated
// with translations available (the '*' page rule matches any pathname).
export const getStaticProps: GetStaticProps = async (ctx) => {
  return {
    props: await ntLoadNamespaces({
      ...i18nConfig,
      pathname: '/',
      locale: ctx.locale ?? i18nConfig.defaultLocale,
      loaderName: 'getStaticProps',
    }),
  }
}
