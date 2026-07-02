import BgRemoverTool from '@/components/bg-remover/BgRemoverTool'

export const metadata = { title: 'ArshaNemi MultiImage Background Remover' }

export default function BgRemoverPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <BgRemoverTool />
    </div>
  )
}
