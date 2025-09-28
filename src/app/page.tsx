import { Widget } from '@/components/Widget'
import { WidgetEvents } from '@/components/WidgetEvents'
import Link from 'next/link'
import { UserGreeting } from '@/components/UserGreeting'
import TransactionHistory from '@/components/TransactionHistory'
import PromptsHelp from '@/components/PromptsHelp'
import ConnectWalletButton from '@/components/ConnectWalletButton'

export default function Home() {
  return (
    <main>
      <ConnectWalletButton />
      <UserGreeting />
      <TransactionHistory />
      <PromptsHelp />
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000 }}>
        <Link
          href="/voice-test"
          style={{
            padding: '10px 20px',
            background: 'rgba(79, 70, 229, 0.8)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          🎤 Voice Test
        </Link>
      </div>
      <WidgetEvents />
      <Widget />
    </main>
  )
}
