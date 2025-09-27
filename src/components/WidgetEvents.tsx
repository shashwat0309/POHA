/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'
import type { Route } from '@lifi/sdk'
import type {
  RouteExecutionUpdate,
  RouteHighValueLossUpdate,
} from '@lifi/widget'
import { useWidgetEvents, WidgetEvent } from '@lifi/widget'
import { useEffect } from 'react'
import { appendTx } from './TransactionHistory'

export const WidgetEvents = () => {
  const widgetEvents = useWidgetEvents()

  useEffect(() => {
    const onRouteExecutionStarted = (_route: Route) => {
      console.log('onRouteExecutionStarted fired.')
    }
    const onRouteExecutionUpdated = (_update: RouteExecutionUpdate) => {
      console.log('onRouteExecutionUpdated fired.')
    }
    const onRouteExecutionCompleted = (route: Route) => {
      try {
        appendTx({
          id: route.id || String(Date.now()),
          ts: Date.now(),
          status: 'completed',
          fromChainId: route.fromChainId,
          toChainId: route.toChainId,
          fromSymbol: route.fromToken?.symbol,
          toSymbol: route.toToken?.symbol,
          amount: Number((route as any).fromAmountUSD || (route as any).fromAmount || 0),
          dex: (route as any)?.steps?.[0]?.toolDetails?.name || (route as any)?.steps?.[0]?.tool,
          routeId: route.id,
        })
      } catch {}
    }
    const onRouteExecutionFailed = (update: RouteExecutionUpdate) => {
      try {
        const route = update.route as unknown as Route
        appendTx({
          id: route?.id || String(Date.now()),
          ts: Date.now(),
          status: 'failed',
          fromChainId: route?.fromChainId,
          toChainId: route?.toChainId,
          fromSymbol: route?.fromToken?.symbol,
          toSymbol: route?.toToken?.symbol,
          amount: Number((route as any)?.fromAmountUSD || (route as any)?.fromAmount || 0),
          dex: (route as any)?.steps?.[0]?.toolDetails?.name || (route as any)?.steps?.[0]?.tool,
          routeId: route?.id,
        })
      } catch {}
    }
    const onRouteHighValueLoss = (_update: RouteHighValueLossUpdate) => {
      console.log('onRouteHighValueLoss continued.')
    }
    widgetEvents.on(WidgetEvent.RouteExecutionStarted, onRouteExecutionStarted)
    widgetEvents.on(WidgetEvent.RouteExecutionUpdated, onRouteExecutionUpdated)
    widgetEvents.on(
      WidgetEvent.RouteExecutionCompleted,
      onRouteExecutionCompleted
    )
    widgetEvents.on(WidgetEvent.RouteHighValueLoss, onRouteHighValueLoss)
    widgetEvents.on(WidgetEvent.RouteExecutionFailed, onRouteExecutionFailed)
    return () => widgetEvents.all.clear()
  }, [widgetEvents])

  return null
}
