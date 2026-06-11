import paper from "paper/dist/paper-core.js";

export const createHeadlessPaperCompiler = () => {
  let scope: any = null;

  const getScope = () => {
    if (scope) {
      return scope;
    }

    scope = new (paper as any).PaperScope();
    scope.setup(new (paper as any).Size(1, 1));
    return scope;
  };

  return {
    run: <Result>(render: (scope: any) => Result) => {
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
