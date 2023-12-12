function findViewNodes(viewNode, depth) {
  var result = {
    depth,
    view: viewNode,
    children: []
  };

  for (var i = 0, icnt = viewNode.childCount(); i < icnt; i++) {
    result.children.push(findViewNodes(viewNode.child(i), depth + 1));
  }

  return result;
}

function printViewNode(viewNode, space) {
  console.log(`${viewNode.depth}${space}${viewNode.view}`);

  for (var i = 0, icnt = viewNode.children.length; i < icnt; i++) {
    printViewNode(viewNode.children[i], `${space}  `);
  }
}

function printRootNode() {
  var root = findViewNodes(auto.rootInActiveWindow, 0);
  printViewNode(root, ' ');
}

printRootNode();
