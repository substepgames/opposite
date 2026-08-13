/* @refresh reload */

import { scaleLinear, select } from 'd3'
import { Component, Match, Switch, createEffect, createSignal, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import { wslobbyUrl } from './constant'
import './index.css'

type State = 'waitJoin' | 'move' | 'opponent'
type Message = { command: 'connected' } | { command: 'color'; isWhite: boolean }

// biome-ignore format:
const layout = {
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
}

const Main: Component = () => {
    const pad = 0.1
    const scale = scaleLinear()
        .domain([0, 1])
        .range([pad, 1 - pad])

    let ws: WebSocket
    let isHost = true

    const [$lobbyId, setLobbyId] = createSignal(0)
    const [$state, setState] = createSignal<State>('waitJoin')
    const [$isWhite, setIsWhite] = createSignal(Math.random() > 0.5)
    const [$boardState, setBoardState] = createSignal(layout.start)
    const [$activePiece, setActivePiece] = createSignal<number | undefined>()

    const $inviteUrl = () => {
        const lobbyId = $lobbyId()
        return `${location.protocol}://${location.host}/${lobbyId}`
    }

    onMount(async () => {
        let lobbyId = Number.parseInt(location.pathname.slice(1))
        if (!Number.isNaN(lobbyId)) {
            isHost = false
            setState($isWhite() ? 'move' : 'opponent')
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
                    if ($state() === 'waitJoin') setState($isWhite() ? 'move' : 'opponent')
                    if (isHost) ws.send(JSON.stringify({ command: 'color', isWhite: !$isWhite() }))
                    break
                }
                case 'color': {
                    // color command is sent by true host, you're not a host then
                    isHost = false
                    setIsWhite(msg.isWhite)
                    setState(msg.isWhite ? 'move' : 'opponent')
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
        ws.send(JSON.stringify({ command: 'connected' }))

        drawBoard()
    })

    createEffect(() => {
        console.debug(`your color is ${$isWhite() ? 'white' : 'red'}`)
    })

    createEffect(() => {
        $activePiece()
        const boardState = $boardState()
        drawPieces(boardState)
    })

    const drawBoard = () => {
        const svg = select('#board')

        svg.selectAll('.edge')
            .data(layout.edges)
            .join('line')
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
            .attr('cx', d => scale(d[0]))
            .attr('cy', d => scale(d[1]))
            .attr('r', 0.01)
            .attr('fill', '#555')
            .lower()
    }

    const drawPieces = (state: number[]) => {
        const piecesPerPlayer = state.length / 2
        const svg = select('#board')

        svg.selectAll('.eligible')
            .data(
                layout.nodes
                    .filter(() => $activePiece() !== undefined)
                    .filter((_, i) =>
                        layout.edges.find(
                            e => (e[0] === i && e[1] === $activePiece()) || (e[1] === i && e[0] === $activePiece())
                        )
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
                setActivePiece(undefined)
            })

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
                const activePiece = $activePiece()
                if (activePiece === d) {
                    setActivePiece(undefined)
                    return
                }
                // TODO: is ours?
                setActivePiece(d)
            })
    }

    return (
        <div class="game">
            <header>
                <span class="title">Opposite</span>
                <Switch>
                    <Match when={$state() === 'waitJoin'}>
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
                    <Match when={$state() === 'move'}>
                        <span>your turn ({$isWhite() ? 'white' : 'red'})</span>
                    </Match>
                    <Match when={$state() === 'opponent'}>
                        <span>opponent's turn ({$isWhite() ? 'red' : 'white'})</span>
                    </Match>
                </Switch>
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
                        <a href="https://github.com/substepgames/opposite">source</a>
                    </span>
                </div>
            </footer>
        </div>
    )
}

render(() => <Main />, document.getElementById('root')!)
