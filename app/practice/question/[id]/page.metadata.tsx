import { Metadata } from 'next';

type Props = {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = params.id;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://testero.ai';
  
  return {
    title: `Practice Question ${id} | Testero`,
    description: 'Test your knowledge with certification practice questions powered by AI.',
    openGraph: {
      title: `Practice Question ${id} | Testero`,
      description: 'Test your knowledge with certification practice questions powered by AI.',
      url: `${baseUrl}/practice/question/${id}`,
      siteName: 'Testero',
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `/practice/question/${id}`,
    },
  };
}
