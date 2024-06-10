import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Link } from "@/components/typography/link";
import { useState } from "react";

const pagesIndexes = (selectedPage: number, pageCount?: number | null) => {
  const indexes: ('...' | number)[] = [];
  if (!pageCount) {
    return indexes;
  }
  for (let i = 0; i < pageCount; i++) {
    if (i < 3 || i > pageCount - 3 || Math.abs(i - selectedPage) < 3) {
      indexes.push(i);
    } else if (indexes.length > 0 && indexes[indexes.length - 1] === '...') {
      continue;
    } else {
      indexes.push('...');
    }
  }
  return indexes;
}

function WordPage({pageIndex}: {pageIndex: number}) {
  const wordPage = useQuery(api.words.pageOfWords, {pageIndex});
  return <div>
    {wordPage?.map(({word}) => <p>{word}</p>)}
  </div>;
}

function App() {
  const pageCount = useQuery(api.words.pageCount);
  const [selectedPage, setSelectedPage] = useState(0);

  const buttons = [];
  for (const index of pagesIndexes(selectedPage, pageCount)) {
    if (index === '...') {
      buttons.push(<span>...</span>);
    } else {
      buttons.push(<button style={{margin: "5px", textDecoration: "underline", color: index === selectedPage ? "blue" : ""}} onClick={() => setSelectedPage(index)}>{index + 1}</button>);
    }
  }

  return (
    <main className="container max-w-2xl flex flex-col gap-8">
      <h1 className="text-4xl font-extrabold my-8 text-center">
        Manual Pagination
      </h1>
      <p>Page: {buttons}</p>
      {pageCount && <WordPage pageIndex={selectedPage} />}
    </main>
  );
}

export default App;
