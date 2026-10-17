"""Bounded candidate admission with cooperative stop and in-flight draining."""
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait


def run_bounded(items, worker, parallel, stop_event):
    """Admit at most N items; stop new admission when the shared event is set."""
    if type(parallel) is not int or not 1 <= parallel <= 4:
        raise ValueError("Parallel must be an integer between 1 and 4")
    pending = set()
    remaining = iter(items)
    with ThreadPoolExecutor(max_workers=parallel) as executor:
        def admit():
            while len(pending) < parallel and not stop_event.is_set():
                try:
                    item = next(remaining)
                except StopIteration:
                    break
                pending.add(executor.submit(worker, item))
        admit()
        while pending:
            done, pending = wait(pending, return_when=FIRST_COMPLETED)
            for future in done:
                future.result()
            admit()
