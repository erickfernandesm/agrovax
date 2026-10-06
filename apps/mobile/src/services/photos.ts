import * as ImagePicker from 'expo-image-picker';
import { platformAdapter } from '../data/store/platformAdapter';

/**
 * Foto do animal.
 *
 * Nesta versao a foto fica SOMENTE no aparelho (fora da memoria do banco
 * local, lida sob demanda). O envio para o servidor depende de um servico de
 * armazenamento de arquivos; a tabela AnimalPhoto ja existe para isso.
 */

const key = (animalId: string) => `animal-photo/${animalId}`;

export type PhotoSource = 'camera' | 'library';

/** Abre a camera ou a galeria e devolve a imagem escolhida, ou null se cancelado. */
export async function pickPhoto(source: PhotoSource): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'Permita o uso da câmera nas configurações do aparelho para tirar a foto.'
        : 'Permita o acesso às fotos nas configurações do aparelho para escolher a imagem.',
    );
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    // Compressao forte: a foto serve para identificar o animal, nao para ampliar.
    quality: 0.2,
    base64: true,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  const asset = result.canceled ? null : result.assets[0];
  if (!asset?.base64) return null;
  return `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
}

export function loadAnimalPhoto(animalId: string): Promise<string | null> {
  return platformAdapter.getBlob(key(animalId));
}

export function saveAnimalPhoto(animalId: string, dataUri: string | null): Promise<void> {
  return platformAdapter.setBlob(key(animalId), dataUri);
}
