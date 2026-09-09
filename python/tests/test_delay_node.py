import threading
import time

from dw_nodes_system import DelayNode, register_system_nodes
from dw_workflow import DANodeFactory


def _delay():
    factory = DANodeFactory()
    register_system_nodes(factory)
    return factory.create_node(DelayNode.qualified_name)


def test_delay_forwards_trigger_after_zero_wait() -> None:
    node = _delay()
    assert node.execute(inputs={"trigger": "go"}, params={"seconds": 0}) is True
    assert node.get_output_data("done") == "go"


def test_delay_cancel_event_unblocks_before_timeout() -> None:
    node = _delay()
    cancel = threading.Event()
    node._dw_cancel = cancel
    started = threading.Event()
    result: list[bool] = []

    def run() -> None:
        started.set()
        result.append(bool(node.execute(inputs={"trigger": True}, params={"seconds": 8})))

    thread = threading.Thread(target=run)
    thread.start()
    assert started.wait(timeout=1)
    time.sleep(0.05)
    t0 = time.monotonic()
    cancel.set()
    thread.join(timeout=2)
    assert not thread.is_alive()
    assert result == [False]
    assert time.monotonic() - t0 < 1.0
