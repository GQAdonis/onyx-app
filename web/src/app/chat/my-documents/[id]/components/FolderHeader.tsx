import React, { useState } from "react";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface FolderHeaderProps {
  name: string;
  description: string;
  sharedAssistants?: string[];
  onEdit: (name: string, description: string) => void;
}

export const FolderHeader: React.FC<FolderHeaderProps> = ({
  name,
  description,
  sharedAssistants,
  onEdit,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editDescription, setEditDescription] = useState(description);

  const handleSave = () => {
    onEdit(editName, editDescription);
    setIsEditing(false);
  };

  return (
    <div className="mb-6">
      {isEditing ? (
        <div className="space-y-4">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Folder name"
          />
          <Textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Folder description"
          />
          <div className="flex space-x-2">
            <Button onClick={handleSave}>Save</Button>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{name}</h1>
            <Button variant="ghost" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" /> Edit
            </Button>
          </div>
          <p className="text-gray-600 mt-2">{description}</p>
          {sharedAssistants && sharedAssistants.length > 0 && (
            <div className="mt-4">
              <p className="font-semibold">Shared with:</p>
              <ul className="list-disc list-inside">
                {sharedAssistants.map((assistant, index) => (
                  <li key={index}>{assistant}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};
