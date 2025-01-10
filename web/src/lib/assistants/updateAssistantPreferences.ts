export async function updateUserAssistantList(
  chosenAssistants: number[]
): Promise<boolean> {
  const response = await fetch("/api/user/assistant-list", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chosen_assistants: chosenAssistants }),
  });

  return response.ok;
}
export async function updateAssistantVisibility(
  assistantId: number,
  show: boolean
): Promise<boolean> {
  const response = await fetch(
    `/api/user/assistant-list/update/${assistantId}?show=${show}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return response.ok;
}

export const toggleAssistantPinnedStatus = async (
  assistantId: number,
  isPinned: boolean
) => {
  const response = await fetch(
    `/api/user/pinned-assistants/${assistantId}?pinned=${isPinned}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistant_id: assistantId,
      }),
    }
  );
  return response;
};

export async function removeAssistantFromList(
  assistantId: number
): Promise<boolean> {
  return updateAssistantVisibility(assistantId, false);
}

export async function addAssistantToList(
  assistantId: number
): Promise<boolean> {
  return updateAssistantVisibility(assistantId, true);
}

export async function moveAssistantUp(
  assistantId: number,
  chosenAssistants: number[]
): Promise<boolean> {
  const index = chosenAssistants.indexOf(assistantId);
  if (index > 0) {
    [chosenAssistants[index - 1], chosenAssistants[index]] = [
      chosenAssistants[index],
      chosenAssistants[index - 1],
    ];
    return updateUserAssistantList(chosenAssistants);
  }
  return false;
}

export async function moveAssistantDown(
  assistantId: number,
  chosenAssistants: number[]
): Promise<boolean> {
  const index = chosenAssistants.indexOf(assistantId);
  if (index < chosenAssistants.length - 1) {
    [chosenAssistants[index + 1], chosenAssistants[index]] = [
      chosenAssistants[index],
      chosenAssistants[index + 1],
    ];
    return updateUserAssistantList(chosenAssistants);
  }
  return false;
}
