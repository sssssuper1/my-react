// babel
function createElement(type, attribute, ...children) {
  return {
    type,
    props: {
      ...attribute,
      children: children.map(child => typeof child === 'object'
        ? child
        : createTextElement(child)),
    }
  }
}

function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: [],
    }
  }
}

let nextUnitOfWork = null
let wipRoot = null
let currentRoot = null
let deletions = null
let wipFiber = null
let hookIndex = null

function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]
  
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }

  const actions = oldHook ? oldHook.queue : []
  actions.forEach(action => hook.state = action(hook.state))

  const setState = action => {
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }

    nextUnitOfWork = wipRoot
    deletions = []
  }

  wipFiber.hooks.push(hook)
  hookIndex++

  return [hook.state, setState]
}

const Didact = {
  createElement,
  useState,
}

/** @jsx Didact.createElement */
function App(props) {
  const [count, setCount] = Didact.useState(0)
  return (
    <div>
      <h3 title="foo">hello {props.name}</h3>
      <p>{count}</p>
      <button onClick={() => setCount(c => c + 1)}>click</button>
    </div>
  )
}

const root = document.getElementById('root')
const page = <App name="react" />
render(page, root)

function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot
  }

  deletions = []
  nextUnitOfWork = wipRoot
}

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    console.log('rendering', nextUnitOfWork.type)
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
    console.log('end')
  }

  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

function performUnitOfWork(fiber) {
  if (fiber.type instanceof Function) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  if (fiber.child) {
    return fiber.child
  }

  let nextFiber = fiber
  while (nextFiber) {
    console.log('find next sibling fiber', nextFiber.type)
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  reconcileChildren(fiber, fiber.props.children)
}

function updateFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let newFiber = null
  let preFiber = null

  while (index < elements.length || oldFiber != null) {
    const element = elements[index]

    const sameType = oldFiber && element && element.type == oldFiber.type

    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE',
      }
    }

    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: 'PLACEMENT'
      }
    }

    if (oldFiber && !sameType) {
      oldFiber.effectTag = 'DELETION'
      deletions.push(oldFiber)
    }

    oldFiber = oldFiber ? oldFiber.sibling : null

    if (index === 0) {
      wipFiber.child = newFiber
    } else {
      preFiber.sibling = newFiber
    }

    preFiber = newFiber
    index++
  }

}

function createDom(fiber) {
  if (fiber.type === 'TEXT_ELEMENT') {
    return document.createTextNode(fiber.props.nodeValue)
  } else {
    const dom = document.createElement(fiber.type)
    updateDom(dom, {}, fiber.props)

    return dom
  }
}

function commitRoot() {
  deletions.forEach(commitElement)
  commitElement(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}

function commitElement(fiber) {
  if (!fiber) return

  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }

  const parentDom = domParentFiber.dom
  if (fiber.effectTag === 'PLACEMENT' && fiber.dom) {
    parentDom.appendChild(fiber.dom)
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  } else if (fiber.effectTag === 'DELETION') {
    commitDeletion(fiber, parentDom)
  }
  
  commitElement(fiber.child)
  commitElement(fiber.sibling)
}

function commitDeletion(fiber, parentDom) {
  if (fiber.dom) {
    parentDom.removeChild(fier.dom)
  } else {
    commitDeletion(fiber.child, parentDom)
  }
}


const isEvent = key => key.startsWith('on')
const isProperty = key => key !== 'children' && !isEvent(key)
const isNew = (prev, next) => (key) => prev[key] != next[key]
const isGone = (prev, next) => (key) => !(key in next)

function updateDom(dom, prevProps, newProps) {
  const prevPropsKeys = Object.keys(prevProps)
  const newPropsKeys = Object.keys(newProps)

  prevPropsKeys
    .filter(isEvent)
    .filter(key => (
      !(key in newProps) ||
      isNew(prevProps, newProps)(key)
    ))
    .forEach(key => {
      const eventType = key.toLowerCase().slice(2)
      dom.removeEventListener(eventType, prevProps[key])
    })

  prevPropsKeys
    .filter(isProperty)
    .filter(isGone(prevProps, newProps))
    .forEach(key => {
      dom.removeAttribute(key)
    })

  newPropsKeys
    .filter(isEvent)
    .filter(isNew)
    .forEach(key => {
      const eventType = key.toLowerCase().slice(2)
      dom.addEventListener(eventType, newProps[key])
    })

  newPropsKeys
    .filter(isProperty)
    .filter(isNew(prevProps, newProps))
    .forEach(key => dom[key] = newProps[key])
}
