import PriorityQueue from "peculiar/priority-queue";

function tracePath(paths, origin, target) {
  let current = target;
  const path = [];

  while (current !== origin) {
    path.push(current);
    current = paths.get(index(current));
  }

  return path.reverse();
}

function index(point) {
  return `${point.x},${point.y}`;
}

function createPathfinder(
  adjacentNodes,
  costHeuristic,
  traversalCost,
  isTraversable
) {
  return function search(origin, target) {
    const frontier = new PriorityQueue();
    const costs = new Map();
    const visited = new Map();

    frontier.push(origin, 0);
    costs.set(index(origin), 0);
    visited.set(index(origin), null);

    while (!frontier.isEmpty()) {
      let current = frontier.poll();

      if (current.x == target.x && current.y == target.y) break;

      for (let candidate of adjacentNodes(current.x, current.y)) {
        if (!isTraversable(candidate.x, candidate.y)) continue;

        let costSum =
          costs.get(index(current)) + traversalCost(candidate.x, candidate.y);

        if (
          !costs.has(index(candidate)) ||
          costSum < costs.get(index(candidate))
        ) {
          costs.set(index(candidate), costSum);
          visited.set(index(candidate), current);
          frontier.push(candidate, costSum + costHeuristic(target, candidate));
        }
      }
    }

    return tracePath(visited, origin, target);
  };
}

export {
  createPathfinder
}
