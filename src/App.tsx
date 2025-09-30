import {
  ChangeEvent,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { constrain, graph, renderImage, type GraphOptions } from './core';

const clamp = (value: number, min: number, max: number) =>
  constrain(Number.isNaN(value) ? min : value, min, max);

const App: FC = () => {
  const [numNails, setNumNails] = useState<number>(300);
  const [maxConnections, setMaxConnections] = useState<number>(10000);
  const [progress, setProgress] = useState<number>(1);

  const progressLabel = useMemo(() => {
    if (progress >= 1 || Number.isNaN(progress)) {
      return <b>Generate</b>;
    }
    return <b>Generating... {(progress * 100).toFixed(2)}%</b>;
  }, [progress]);

  const options: GraphOptions = useMemo(
    () => ({
      numNails,
      maxConnections,
      onProgress: setProgress,
    }),
    [numNails, maxConnections],
  );

  const triggerRender = useCallback(
    (imageUrl?: string) => {
      renderImage(options, imageUrl);
    },
    [options],
  );

  const handleNumNailsChange = (value: number) => {
    setNumNails((prev) => {
      const next = clamp(value, 10, 2000);
      return next === prev ? prev : next;
    });
  };

  const handleMaxConnectionsChange = (value: number) => {
    setMaxConnections((prev) => {
      const next = clamp(value, 100, 15000);
      return next === prev ? prev : next;
    });
  };

  const handleNumberInputChange =
    (setter: (value: number) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setter(Number(event.target.value));
    };

  const handleNumberInputBlur = (
    value: number,
    setter: (value: number) => void,
    min: number,
    max: number,
  ) => {
    setter(clamp(value, min, max));
  };

  const handleGenerateClick = () => {
    triggerRender();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    triggerRender(url);
  };

  return (
    <div id="ui">
      <img id="snapshot" src="" />
      <input
        type="file"
        accept="image/jpeg, image/png, image/jpg"
        onChange={handleFileChange}
      />
      <br />

      <div id="controls">
        <button id="generate" type="button" onClick={handleGenerateClick}>
          {progressLabel}
        </button>
      </div>

      <details id="download" open>
        <summary>Downloads</summary>
        <button type="button" onClick={() => graph.downloadNailSeq()}>
          Nail sequence
        </button>
        <button type="button" onClick={() => graph.downloadFrame()}>
          Frame with numbering
        </button>
      </details>

      <details id="basic" open>
        <summary>Basic Options</summary>
        <label htmlFor="numNails">Number of nails:</label>
        <input
          id="numNails"
          className="slider"
          type="number"
          value={numNails}
          min={10}
          max={2000}
          step={1}
          onChange={handleNumberInputChange(handleNumNailsChange)}
          onBlur={(event) =>
            handleNumberInputBlur(
              Number(event.target.value),
              handleNumNailsChange,
              10,
              2000,
            )
          }
        />
        <label htmlFor="numConnections">Max # of connections:</label>
        <input
          id="numConnections"
          className="slider"
          type="number"
          value={maxConnections}
          min={100}
          max={15000}
          step={1}
          onChange={handleNumberInputChange(handleMaxConnectionsChange)}
          onBlur={(event) =>
            handleNumberInputBlur(
              Number(event.target.value),
              handleMaxConnectionsChange,
              100,
              15000,
            )
          }
        />
      </details>
    </div>
  );
};

export default App;
