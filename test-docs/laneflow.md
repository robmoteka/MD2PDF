# LaneFlow diagram test fixture

## Linear process (default direction)

```laneflow
laneflow v0.1

lane Sales "Sales"

Sales: start    (Order received)
Sales: verify   [Verify order details]
Sales: confirm  [Confirm order]
Sales: done     ((Order confirmed))

start --> verify --> confirm --> done
```

## Gateway with direction LR

```laneflow LR
laneflow v0.1
direction LR

lane Sales "Sales"

Sales: start   (Order received)
Sales: decide  <In stock?>
Sales: confirm [Confirm order]
Sales: reject  [Reject order]
Sales: done    ((Done))

start --> decide
decide -- yes --> confirm --> done
decide -- no  --> reject  --> done
```

## Multi-lane message flow

```laneflow
laneflow v0.1

lane Sales     "Sales"
lane Warehouse "Warehouse"

Sales:     start   (Order received)
Sales:     check   [Check availability]
Warehouse: pack    [Pack order]
Warehouse: done    ((Shipped))

start --> check
check --> pack
pack --> done
```

## Invalid diagram (should show error block)

```laneflow
this is not valid laneflow syntax at all
```
