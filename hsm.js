function createMachine(stateMachineDefinition) {

  const machine = {

    value: stateMachineDefinition.initialState,

    async transition(currentState, event) {

      const currentStateDefinition = stateMachineDefinition[currentState]

      const destinationTransition = currentStateDefinition.transitions[event]

      if (!destinationTransition) {

        return

      }

      const destinationState = destinationTransition.target

      const destinationStateDefinition =

        stateMachineDefinition[destinationState]

      await destinationTransition.action()

      currentStateDefinition.actions.onExit()

      await destinationStateDefinition.actions.onEnter()

      machine.value = destinationState

      return machine.value

    },

  }

  return machine

}

module.exports.createMachine = createMachine;