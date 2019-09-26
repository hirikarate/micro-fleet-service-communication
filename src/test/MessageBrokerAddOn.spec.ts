import * as chai from 'chai'
import * as spies from 'chai-spies'

import { IConfigurationProvider, Maybe } from '@micro-fleet/common'

import { IMessageBrokerConnector, MessageBrokerConnectionOptions, MessageBrokerPublishOptions,
    MessageHandleFunction, MessageBrokerProviderAddOn } from '../app'


chai.use(spies)
const expect = chai.expect


class MockConfigAddOn implements IConfigurationProvider {

    public readonly name: string = 'MockConfigAddOn'
    public configFilePath: string

    get enableRemote(): boolean {
        return true
    }

    public get(key: string): Maybe<number | boolean | string> {
        return Maybe.Just('')
    }

    public deadLetter(): Promise<void> {
        return Promise.resolve()
    }

    public fetch(): Promise<boolean> {
        return Promise.resolve(true)
    }

    public init(): Promise<void> {
        return Promise.resolve()
    }

    public dispose(): Promise<void> {
        return Promise.resolve()
    }

    public onUpdate(listener: (delta: string[]) => void) {
        // Empty
    }
}

class MockMbConnector implements IMessageBrokerConnector {
    public name = 'MockMbConnector'

    public messageExpiredIn: number
    public subscribedPatterns: string[]

    public get queue(): string {
        return ''
    }

    public connect(options: MessageBrokerConnectionOptions): Promise<void> {
        return Promise.resolve()
    }

    public disconnect(): Promise<void> {
        return Promise.resolve()
    }

    public deleteQueue(): Promise<void> {
        return Promise.resolve()
    }

    public emptyQueue(): Promise<number> {
        return Promise.resolve(0)
    }

    public listen(onMessage: MessageHandleFunction, noAck?: boolean): Promise<void> {
        return Promise.resolve()
    }

    public stopListen(): Promise<void> {
        return Promise.resolve()
    }

    public publish(topic: string, payload: any, options?: MessageBrokerPublishOptions): Promise<void> {
        return Promise.resolve()
    }

    public subscribe(matchingPattern: string): Promise<void> {
        return Promise.resolve()
    }

    public unsubscribe(consumerTag: string): Promise<void> {
        return Promise.resolve()
    }

    public unsubscribeAll(): Promise<void> {
        return Promise.resolve()
    }

    public onError(handler: (err: any) => void): void {
        // Empty
    }
}

function createConnector() {
    return new MockMbConnector()
}

describe('MessageBrokerAddOn', () => {
    describe('init', () => {
        it('should call connector.connect', async () => {
            // Arrange
            const dbAddOn = new MessageBrokerProviderAddOn(createConnector, new MockConfigAddOn()),
                connectSpy = chai.spy.on(dbAddOn['_msgBrokerCnn'], 'connect')

            // Act
            await dbAddOn.init()

            // Assert
            expect(connectSpy).to.be.spy
            expect(connectSpy).to.have.been.called.once
        })
    }) // END describe 'init'

    describe('dispose', () => {
        it('should call connector.disconnect', async () => {
            // Arrange
            const dbAddOn = new MessageBrokerProviderAddOn(createConnector, new MockConfigAddOn()),
                disconnectSpy = chai.spy.on(dbAddOn['_msgBrokerCnn'], 'disconnect')

            // Act
            await dbAddOn.dispose()

            // Assert
            expect(disconnectSpy).to.be.spy
            expect(disconnectSpy).to.have.been.called.once
        })
    }) // END describe 'dispose'
})
