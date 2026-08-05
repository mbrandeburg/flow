import Head from 'next/head'
import useTranslation from 'next-translate/useTranslation'

export interface SeoProps {
  scope?: string
  title?: string
  description?: string
}

export const Seo: React.FC<SeoProps> = ({ scope, title, description }) => {
  const { t } = useTranslation()
  title = title ?? t(`page.${scope}.title`)

  if (!title) {
    throw new Error('Title is empty')
  }

  return (
    <Head>
      <title>{scope === 'home' ? title : `${title} - Flow`}</title>
      <meta name="description" content={description ?? t('desc')} />
    </Head>
  )
}
