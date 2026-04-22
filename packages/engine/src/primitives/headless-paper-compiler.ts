import paper from "paper/dist/paper-core.js";

export const createHeadlessPaperCompiler = () => {
  let scope: paper.PaperScope | null = null;

  const getScope = () => {
    if (scope) {
      return scope;
    }

    scope = new paper.PaperScope();
    scope.setup(new paper.Size(1, 1));
    return scope;
  };

  return {
    run: <Result>(render: (scope: paper.PaperScope) => Result) => {
      const nextScope = getScope();
      nextScope.project.clear();

      try {
        return render(nextScope);
      } finally {
        nextScope.project.clear();
      }
    },
  };
};
