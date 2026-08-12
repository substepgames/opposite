/* @refresh reload */

import { scaleLinear, select } from 'd3'
import { Component, Match, Switch, createSignal, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import './index.css'

type State = 'waitJoin' | 'move' | 'opponent'

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
    const [$lobbyId, setLobbyId] = createSignal(Math.floor(Math.random() * 10000))
    const [$state, setState] = createSignal<State>('waitJoin')
    const $inviteUrl = () => {
        const lobbyId = $lobbyId()
        return `${location.protocol}://${location.host}/${lobbyId}`
    }

    onMount(() => {
        let lobbyId = Number.parseInt(location.pathname.slice(1))
        if (!Number.isNaN(lobbyId)) {
            setLobbyId(lobbyId)
            setState('move')
        } else {
            lobbyId = $lobbyId()
        }
        history.pushState({}, '', `/${lobbyId.toString()}`)
        drawBoard()
    })

    const drawBoard = () => {
        const pad = 0.1
        const scale = scaleLinear()
            .domain([0, 1])
            .range([pad, 1 - pad])

        const svg = select('#board')

        svg.selectAll('line')
            .data(layout.edges)
            .join('line')
            .attr('x1', d => scale(layout.nodes[d[0]][0]))
            .attr('y1', d => scale(layout.nodes[d[0]][1]))
            .attr('x2', d => scale(layout.nodes[d[1]][0]))
            .attr('y2', d => scale(layout.nodes[d[1]][1]))
            .attr('stroke', '#555')
            .attr('stroke-width', 0.005)

        svg.selectAll('circle')
            .data(layout.nodes)
            .join('circle')
            .attr('cx', d => scale(d[0]))
            .attr('cy', d => scale(d[1]))
            .attr('r', 0.01)
            .attr('fill', '#555')
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
                        <span>your turn</span>
                    </Match>
                    <Match when={$state() === 'opponent'}>
                        <span>opponent's turn</span>
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
