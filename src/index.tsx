/* @refresh reload */

import { scaleLinear, select } from 'd3'
import { Component, For, Match, Switch, createEffect, createSignal, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import './index.css'

type State = 'invite' | 'wait' | 'move' | 'opponent'
type Message =
    | { command: 'connected' }
    | {
          command: 'state'
          state: number[]
      }
    | {
          command: 'new'
          layout: keyof typeof layout
          state: number[]
          color: boolean
          move: boolean
      }

type Layout = {
    nodes: number[][]
    edges: number[][]
    start: number[]
}

// biome-ignore format:
const layout: Record<'hourglass' | 'hourglassExtended', Layout> = {
    hourglass: {
        nodes: [
            [0/2, 0/3], [1/2, 0/3], [2/2, 0/3],
            [0/2, 1/3], [1/2, 1/3], [2/2, 1/3],
            [0/2, 2/3], [1/2, 2/3], [2/2, 2/3],
            [0/2, 3/3], [1/2, 3/3], [2/2, 3/3],
        ],
        edges: [
            [0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8], [9, 10], [10, 11],
            [0, 3], [1, 4], [2, 5],
            [4, 7],
            [6, 9], [7, 10], [8, 11]
        ],
        start: [0, 1, 2, 9, 10, 11]
    },
    hourglassExtended: {
        nodes: [
            [0/2, 0/4], [1/2, 0/4], [2/2, 0/4],
            [0/2, 1/4], [1/2, 1/4], [2/2, 1/4],
            [0/2, 2/4], [1/2, 2/4], [2/2, 2/4],
            [0/2, 3/4], [1/2, 3/4], [2/2, 3/4],
            [0/2, 4/4], [1/2, 4/4], [2/2, 4/4],
        ],
        edges: [
            [3, 4], [4, 5], [9, 10], [10, 11],
            [4, 7], [7, 10],
            [6, 7], [7, 8],
            [0, 3], [1, 4], [2, 5], [9, 12], [10, 13], [11, 14]
        ],
        start: [0, 1, 2, 12, 13, 14]
    }
}

const Main: Component = () => {
    const pad = 0.08
    const scale = scaleLinear()
        .domain([0, 1])
        .range([pad, 1 - pad])

    let ws: WebSocket
    const sfx = {
        move: new Audio('sfx/move.ogg')
    }

    const [$lobbyId, setLobbyId] = createSignal(0)
    const [$state, setState] = createSignal<State>('invite')
    const [$color, setColor] = createSignal(Math.random() > 0.5)
    const [$isHost, setIsHost] = createSignal(true)
    const [$layout, setLayout] = createSignal<keyof typeof layout>('hourglassExtended')
    const [$boardState, setBoardState] = createSignal(layout[$layout()].start)
    const [$activePiece, setActivePiece] = createSignal<number | undefined>()

    const $inviteUrl = () => {
        const lobbyId = $lobbyId()
        return `${location.protocol}//${location.host}/${lobbyId}`
    }

    onMount(async () => {
        let lobbyId = Number.parseInt(location.pathname.slice(1))
        if (!(Number.isNaN(lobbyId) || lobbyId === 0)) {
            setIsHost(false)
            setState('wait')
        } else {
            lobbyId = Math.floor(Math.random() * 10000)
        }
        history.pushState({}, '', `/${lobbyId.toString()}`)
        setLobbyId(lobbyId)

        ws = new WebSocket(`${wslobbyUrl}/${lobbyId}`)
        ws.addEventListener('message', async e => {
            const msg: Message = JSON.parse(await (e.data as Blob).text())
            console.debug('msg', msg)
            switch (msg.command) {
                case 'connected': {
                    if ($state() === 'invite') setState($color() ? 'move' : 'opponent')
                    if ($isHost()) {
                        sendMessage({
                            command: 'new',
                            layout: $layout(),
                            state: $boardState(),
                            color: !$color(),
                            move: $state() === 'opponent'
                        })
                    }
                    break
                }
                case 'state': {
                    setBoardState(msg.state)
                    setState('move')
                    sfx.move.play()
                    break
                }
                case 'new': {
                    setBoardState(msg.state)
                    setLayout(msg.layout)
                    setColor(msg.color)
                    setState(msg.move ? 'move' : 'opponent')
                    break
                }
            }
        })
        ws.addEventListener('error', () => alert('server is down :('))
        await new Promise<void>(resolve =>
            ws.addEventListener('open', () => {
                console.debug('ws connected')
                resolve()
            })
        )
        sendMessage({ command: 'connected' })
    })

    createEffect(() => {
        drawBoard(layout[$layout()])
    })

    createEffect(() => {
        $activePiece()
        const boardState = $boardState()
        const l = layout[$layout()]
        drawPieces(l, boardState)
    })

    const sendMessage = (message: Message) => {
        ws.send(JSON.stringify(message))
    }

    const drawBoard = (layout: Layout) => {
        const svg = select('#board')

        svg.selectAll('.edge')
            .data(layout.edges)
            .join('line')
            .attr('class', 'edge')
            .attr('x1', d => scale(layout.nodes[d[0]][0]))
            .attr('y1', d => scale(layout.nodes[d[0]][1]))
            .attr('x2', d => scale(layout.nodes[d[1]][0]))
            .attr('y2', d => scale(layout.nodes[d[1]][1]))
            .attr('stroke', '#555')
            .attr('stroke-width', 0.005)
            .lower()

        svg.selectAll('.node')
            .data(layout.nodes)
            .join('circle')
            .attr('class', 'node')
            .attr('cx', d => scale(d[0]))
            .attr('cy', d => scale(d[1]))
            .attr('r', 0.01)
            .attr('fill', '#555')
            .lower()
    }

    const drawPieces = (layout: Layout, state: number[]) => {
        if (layout.nodes.length < Math.max(...state)) return
        const piecesPerPlayer = state.length / 2
        const svg = select('#board')

        svg.selectAll('.piece')
            .data(state)
            .join('circle')
            .attr('class', 'piece')
            .attr('cx', d => scale(layout.nodes[d][0]))
            .attr('cy', d => scale(layout.nodes[d][1]))
            .attr('r', 0.06)
            .attr('fill', (_, i) => (i < piecesPerPlayer ? '#fff' : '#aa0000'))
            .attr('stroke', (d, i) => (d === $activePiece() ? '#99ff55' : i < piecesPerPlayer ? '#999' : '#660000'))
            .attr('stroke-width', 0.01)
            .on('click', (_, d) => {
                if ($state() !== 'move') return
                const i = state.indexOf(d)
                if (i < 0) return
                const isWhitePiece = i < piecesPerPlayer
                if (isWhitePiece !== $color()) return
                const activePiece = $activePiece()
                if (activePiece === d) {
                    setActivePiece(undefined)
                    return
                }
                setActivePiece(d)
            })

        svg.selectAll('.eligible')
            .data(
                layout.nodes
                    .filter(() => $activePiece() !== undefined)
                    .filter(
                        (_, i) =>
                            layout.edges.find(
                                e => (e[0] === i && e[1] === $activePiece()) || (e[1] === i && e[0] === $activePiece())
                            ) && !state.includes(i)
                    )
            )
            .join('circle')
            .attr('class', 'eligible')
            .attr('cx', d => scale(d[0]))
            .attr('cy', d => scale(d[1]))
            .attr('r', 0.06)
            .attr('fill', '#fff')
            .attr('opacity', 0.1)
            .on('click', (_, d) => {
                const i = layout.nodes.indexOf(d)
                const activePiece = $activePiece()
                if (activePiece === undefined) return

                const state = [...$boardState()]
                state[state.indexOf(activePiece)] = i
                setBoardState(state)

                sendMessage({ command: 'state', state: $boardState() })
                setState('opponent')

                setActivePiece(undefined)

                sfx.move.play()
            })
    }

    const becomeHost = () => {
        setIsHost(true)
        setState('invite')
    }

    const newGame = () => {
        const state = [...layout[$layout()].start]
        setBoardState(state)
        const color = !$color()
        setColor(color)
        sendMessage({ command: 'new', layout: $layout(), state, color: !color, move: !color })
        setState(color ? 'move' : 'opponent')
    }

    const skipTurn = () => {
        sendMessage({ command: 'state', state: $boardState() })
        setState('opponent')
    }

    return (
        <div class="game">
            <header>
                <span class="title">Opposites</span>
                <div class="controls">
                    <select
                        value={$layout()}
                        onInput={e => {
                            const l = e.target.value as keyof typeof layout
                            setBoardState(layout[l].start)
                            setLayout(l)
                        }}
                        disabled={!$isHost()}
                    >
                        <For each={Object.keys(layout)}>{name => <option value={name}>{name}</option>}</For>
                    </select>
                    <button type="button" onClick={becomeHost} disabled={$state() !== 'wait'}>
                        become host
                    </button>
                    <button type="button" onClick={newGame} disabled={!$isHost()}>
                        new game
                    </button>
                    <button type="button" onClick={skipTurn} disabled={$state() !== 'move'}>
                        skip turn
                    </button>
                </div>
                <div class="status">
                    <Switch>
                        <Match when={$state() === 'invite'}>
                            <span>
                                waiting for opponent, invite{' '}
                                <a
                                    href={$inviteUrl()}
                                    onClick={e => {
                                        e.preventDefault()
                                        alert('send it to your friend!')
                                    }}
                                >
                                    {$inviteUrl()}
                                </a>
                            </span>
                        </Match>
                        <Match when={$state() === 'wait'}>
                            <span>waiting for host</span>
                        </Match>
                        <Match when={$state() === 'move'}>
                            <span>your turn ({$color() ? 'white' : 'red'})</span>
                        </Match>
                        <Match when={$state() === 'opponent'}>
                            <span>opponent's turn ({$color() ? 'red' : 'white'})</span>
                        </Match>
                    </Switch>
                </div>
            </header>
            <svg id="board" viewBox="0 0 1 1" preserveAspectRatio="xMidYMin meet" />
            <footer>
                <div class="rules">
                    <span>rules:</span>
                    <span>- each player has 3 pieces</span>
                    <span>- goal is to move all pieces to the opponent's starting nodes</span>
                    <span>- players take turns by playing one piece</span>
                    <span>- piece can only move along the edge to the unoccupied node</span>
                    <span>- same piece can only move along the same edge twice in a row</span>
                    <span>- zero legal moves skips the turn</span>
                </div>
                <div class="credits">
                    <span>
                        original idea by <a href="https://www.instagram.com/dr.anitayfai">@dr.anitayfai</a>
                    </span>
                    <span>
                        implementation by <a href="https://substepgames.com/">Substep Games</a>
                    </span>
                    <span>
                        <a href="https://github.com/substepgames/opposites">source</a>
                    </span>
                </div>
            </footer>
        </div>
    )
}

render(() => <Main />, document.getElementById('root')!)
